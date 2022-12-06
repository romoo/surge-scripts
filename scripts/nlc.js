/*
国家图书馆预约监控
-----------------
[Script]
国家图书馆预约监控 = type=cron, cronexp=* 9-21 * * *, script-path=https://raw.githubusercontent.com/romoo/surge-scripts/main/scripts/nlc.js

[MITM]
hostname = %APPEND% gtweixin.nlc.cn
*/

const $cookie = $persistentStore.read('nlc-cookies');
console.log(`Cookie: ${$cookie}`);

const timestamp = Date.parse(new Date());
const today = new Date().toJSON().slice(0, 10);
const openTimeRange = [9, 21]; // 可预约时间段
const date = getDate();
console.log(`date: ${date}`);

!(async () => {
  if (!$cookie) {
    $notification.post('国家图书馆', '❌ 获取 Cookies 失败，请手动打开公众号内预定页面', '');
  } else {
    await booking();
  }
})().catch((err) => {
  console.log('出现错误');
  console.log(err.message);
}).finally(() => $done({}));

async function booking() {
  if (!isDateAvailable(date)) {
    $notification.post('国家图书馆', '❌ 日期无效', date);
    return;
  }
  if (!isInOpenTime()) {
    // $notification.post('国家图书馆', '', '❌ 不在营业时间');
    console.log('❌ 不在营业时间');
    return;
  }
  const agreement = await setAgreement();
  if (!agreement) {
    console.log('❌ 协议页面报错，可能是Cookie失效');
    return;
  }
  const hasSchedule = await checkSchedule();
  if (hasSchedule) {
    // 已经预约
    console.log('❌ 已有预约');
    return;
  }
  const [timeTableId, indx] = await getTimetableId();
  if (!timeTableId || !indx) {
    console.log('❌ timeTableId 和 indx 获取失败');
    return;
  }
  const venue = await getVenue(timeTableId, indx);
  if (!venue) {
    console.log('❌ venue 获取失败，可能是已预约完');
    return;
  }
  const timeSlot = await getTimeSlot(timeTableId, venue);
  if (!timeSlot) {
    console.log('❌ timeSlot 获取失败，可能是剩余0');
    return;
  }
  // const order = await prepareOrder(timeTableId, venue, timeSlot);
  const orderId = await createOrder(timeTableId, venue, timeSlot);
  if (!orderId) {
    console.log('❌ orderId 获取失败');
    return;
  }
  const result = await checkOrder(orderId);
  if (result) {
    $notification.post('国家图书馆', '预约成功🎉', date);
  }
}

function isDateAvailable(date) {
  // 不能预约之前的日期，周一闭馆
  if (new Date(date).getDay() === 1) {
    return false;
  }
  if (new Date(date) < new Date(new Date().toDateString())) {
    return false;
  }
  return true;
}

function generateHeaders() {
  return {
    'Cookie': $cookie,
    'Host': 'gtweixin.nlc.cn',
    'Connection': 'keep-alive',
    'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.30(0x18001e30) NetType/WIFI Language/zh_CN',
    'X-Requested-With': 'XMLHttpRequest',
  }
}

function setAgreement() {
  const form = {
    action: 'agree',
    checkbox: 1,
  };
  const url = `https://gtweixin.nlc.cn/subscribe/agreement.html?${objToUrlParams(form)}`;
  const option = {
    url,
    headers: {
      ...generateHeaders(),
      'Content-Type': 'application/x-www-form-urlencoded;',
    },
  };
  return new Promise((resolve) => {
    $httpClient.post(option, (err, res, data) => {
      if (res.status === 200) {
        const ret = JSON.parse(data);
        if (ret.url) {
          resolve(false);
        } else if (ret.status) {
          resolve(true);
        }
      }
      resolve(false);
    });
  });
}

function checkSchedule() {
  const url = `https://gtweixin.nlc.cn/subscribe/index/get.html?t=${timestamp}`;
  const option = {
    url,
    headers: generateHeaders(),
  };
  return new Promise((resolve) => {
    $httpClient.get(option, (err, res, data) => {
      if (res.status === 200) {
        const ret = JSON.parse(data);
        if (ret.status) {
          const {
            list,
          } = ret.data;
          const schedule = list.find(item => item.schedule === date);
          if (!schedule) {
            // 没有预约
            resolve(false);
            return;
          }
          if (schedule.status.value === '0') {
            // 已预约
            resolve(true);
          }
          resolve(false);
        }
      }
      resolve(false);
    });
  });
}

function getTimetableId() {
  const url = 'https://gtweixin.nlc.cn/subscribe/order.html';
  const option = {
    url,
    headers: generateHeaders(),
  };
  return new Promise((resolve) => {
    $httpClient.get(option, (err, res, data) => {
      if (res.status === 200) {
        const reg = new RegExp(`data-day="${date}" data-id="(\\d+)" data-indx="(\\d+)"`, 'g');
        const matches = reg.exec(data);
        if (!matches) {
          console.log('❌ 日期匹配失败');
          resolve(false);
        }
        resolve([matches[1], matches[2]]);
      }
      resolve(false);
    });
  });
}

function getVenue(timeTableId, indx) {
  const url = `https://gtweixin.nlc.cn/subscribe/order/subscribe.html?day=${date}&timetableId=${timeTableId}&indx=${indx}&${timestamp}`;
  const option = {
    url,
    headers: generateHeaders(),
  };
  return new Promise((resolve) => {
    $httpClient.post(option, (err, res, data) => {
      if (res.status === 200) {
        const ret = JSON.parse(data);
        if (ret.status) {
          const {
            list,
            order_form,
          } = ret.data;
          if (order_form.surplus === 0) {
            // 预约完
            // resolve(false);
          }
          resolve(list.find(item => item[1] === '总馆馆区')[0]);
        }
        resolve(false);
      }
      resolve(false);
    });
  });
}

function getTimeSlot(timeTableId, venue) {
  const url = `https://gtweixin.nlc.cn/subscribe/order/timeslot.html?timetableId=${timeTableId}&venue=${venue}&t=${timestamp}`;
  const option = {
    url,
    headers: generateHeaders(),
  };
  return new Promise((resolve) => {
    $httpClient.get(option, (err, res, data) => {
      if (res.status === 200) {
        const ret = JSON.parse(data);
        if (ret.status) {
          if (ret.data[0][1].indexOf('(剩余0)') > -1) {
            resolve(false);
            return;
          }
          resolve(ret.data[0][0]); // [["13616","9:00-17:00 (剩余1)"]]
        }
      }
      resolve(false);
    });
  });
}

function prepareOrder(timeTableId, venue, timeSlot) {
  const url = `https://gtweixin.nlc.cn/subscribe/order/tips.html?day=${date}&timetableId=${timeTableId}&venue=${venue}&timeslot=${timeSlot}&order_type=10&t=${timestamp}`;
  const option = {
    url,
    headers: generateHeaders(),
  };
  return new Promise((resolve) => {
    $httpClient.get(option, (err, res, data) => {
      if (res.status === 200) {
      }
    })
  })
}

function createOrder(timeTableId, venue, timeSlot) {
  const form = {
    action: 'create',
    resubmit: 0,
    day: date,
    venue,
    timeslot: timeSlot,
    order_type: 10,
    timetableId: timeTableId,
  };
  const url = `https://gtweixin.nlc.cn/subscribe/order.html?${objToUrlParams(form)}&t=${timestamp}`;
  const option = {
    url,
    headers: {
      ...generateHeaders(),
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
  };
  return new Promise((resolve) => {
    $httpClient.post(option, (err, res, data) => {
      if (res.status === 200) {
        const ret = JSON.parse(data);
        if (ret.status) {
          const {
            // is_carray,
            orderId,
          } = ret.data;
          if (orderId) {
            // 预约完
            resolve(orderId);
          }
          resolve(false);
        }
        // 可能不在预约开放时间
        resolve(false);
      }
      resolve(false);
    })
  })
}

function checkOrder(orderId) {
  const url = `https://gtweixin.nlc.cn/subscribe/order/chk.html?orderId=${orderId}&t=${timestamp}`;
  const option = {
    url,
    headers: generateHeaders(),
  };
  return new Promise((resolve) => {
    $httpClient.get(option, (err, res, data) => {
      if (res.status === 200) {
        const ret = JSON.parse(data);
        if (ret.status) {
          if (ret.data.result === 'success') {
            // 成功
            $notification.post('国家图书馆', '预约成功🎉', date);
            resolve(true);
          }
        }
      }
      resolve(false);
    })
  })
}

function isInOpenTime() {
  const currentHour = new Date().getHours();
  if (currentHour >= openTimeRange[0] &&
    currentHour < openTimeRange[1]) {
    return true;
  }
  return false;
};

function getDate() {
  const storeDate = $persistentStore.read('nlc-date');
  console.log(`storeDate: ${storeDate}`);
  if (typeof $intent !== 'undefined') {
    // 通过 iOS Workflow 调用脚本
    $persistentStore.write($intent.parameter, 'nlc-date');
    console.log(`$intent.parameter: ${$intent.parameter}`);
    return $intent.parameter;
  }
  if (storeDate) {
    return storeDate;
  }
  return today;
}

function objToUrlParams(obj) {
  return Object.keys(obj).map(function (key) {
    return key + '=' + obj[key];
  }).join('&');
}
