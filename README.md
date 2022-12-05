# surge-scripts

Surge 脚本

## Scripts

### 国家图书馆 - 预约入馆

```
https://raw.githubusercontent.com/romoo/surge-scripts/main/scripts/nlc.sgmodule
```

需配合「脚本」和「MitM」使用。第一次使用需要先打开「国家图书馆」公众号预约页面，脚本会自动记录 Cookies。

默认预约当天，可通过 [Surge HTTP API](https://manual.nssurge.com/others/http-api.html) 控制 `$persistentStore` 来修改预约日期，可参考下面的快捷指令：

https://www.icloud.com/shortcuts/af788f9e73f847e8bf7ccd80f290984c


## License

[MIT](LICENSE)
