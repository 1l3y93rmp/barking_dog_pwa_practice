// JS 的 Proxy，這裡的Console 可以傳到外面
console.log(self)
const CACHE_VERSION = 1; // 以後每次 動態快取 static & dynamic 快取住的 檔案有更新，記得來這邊改版本號

// 下面是很多的偵聽
self.addEventListener('install', function(event){
    console.log('[SW]: 成功安裝(Install) Service Worker!',event);
    // 重開網頁是不會觸發安裝的!
    // 如果這個檔案有改變，會觸發重新安裝
    // Service Worker 永遠只會有一個 新的啟動了會把舊的踢掉，但是會等候舊的沒有控制任何資源時後才會刪掉

    // install 同時也是存快取的好地方，但是可能cache 到一半已經執行到 fetch，倒至沒抓完
    // waitUntil 避免已嵌執行到 fetch 還沒抓完
    event.waitUntil(
        caches.open('static_'+ CACHE_VERSION) // 預先快取"固定"要使用的資源，快取可以有好幾個陣列 此陣列叫 static
        .then(function(cache){ // 這裡放的是一些固定不變的資源，至會變的要存到叫 dynamic 的動態快取裡
            cache.addAll([
                '/',
                '/index.html',
                '/favicon.ico',
                '/manifest.json'
            ]);  
        })  
    )
});


self.addEventListener('activate', function(event){
    console.log('[SW]: 啟用(Activate) Service Worker!',event);
    // 成功啟用後，在此檢查快取清單"名稱"是否有更新
    event.waitUntil()

    return self.clients.claim(); // 強制控制到沒有控制的資源
});

self.addEventListener('fetch', function(event){
    console.log('[SW] 抓資料(Fetch)!',event.request.url); // 當主要 JS 發送了 fetch 事件
    // 經常重整之後才會被觸發
    // 包括本身的HTML，icon、圖片、各種靜態資料 (HTML除外)、 所有外掛套件

    event.respondWith(
        caches.match(event.request) // caches.match , 當"所有"快取中有對應到當前的 request 就執行以下 (用Then 非同步的)
            .then(function(response){ // 這個 response 指的是快取撈出來的 response，撈不到會拿到 nul
                if(response){
                    return response; // 有撈到就返回 快取撈出來的 response
                }else{
                    if (event.request.url === 'http://localhost:3001/js/main.js') {
                        // 註: main.js 會掉到這邊才被存入 dynamic 動態快取
                        return fetch(event.request) // 一樣先丟執行
                            .then(function(res){ // then 接續工作 取得 res (fetch 得到的物件)
                                caches.open('dynamic_'+ CACHE_VERSION) // 快取 開啟新的 dynamic cache
                                    .then(function(cache){ // 開啟後的才能取得 cache
                                        console.log('塞進 dynamic 動態快取')
                                        cache.put(event.request.url, res.clone()); // 塞入一個複製的
                                        return res; // 最終還是要 return res 這是Returm 給 open 用的(異動完畢後Return)
                                    })
                            });
                    } else {
                        // 隨機狗狗圖片 & API 則設定不存到任何快取中
                        return fetch(event.request)
                    }

                }
            })
    )
});