/*
国家图书馆获取Cookie
-----------------
[Script]
国家图书馆获取Cookie = type=http-request, pattern=https:\/\/gtweixin.nlc.cn\/subscribe$, script-path=https://raw.githubusercontent.com/romoo/surge-scripts/main/scripts/nlc-cookies.js, requires-body=true

[MITM]
hostname = %APPEND% gtweixin.nlc.cn
*/

getCookie();

function getCookie() {
  if (
    $request &&
    $request.url.match(/subscribe/)
  ) {
    $cookie = $request.headers['Cookie'];
    console.log($cookie);
    $notification.post('国家图书馆', 'Cookies 获取成功🎉', $cookie);
    $persistentStore.write($cookie, 'nlc-cookies');
  } else {
    $notification.post('国家图书馆', '❌ 获取 Cookies 失败，请手动打开公众号内预定页面', '');
  }
  $done({});
}
