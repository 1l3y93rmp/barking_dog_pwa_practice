// JS 的 Proxy，這裡的Console 可以傳到外面

// 下面是很多的偵聽
self.addEventListener('install', function(event){
    console.log('[SW]: 成功安裝(Install) Service Worker!',event);
    // 重開網頁是不會觸發安裝的!
    // 第二次造訪 : 會被 Fetch
    // 如果這個檔案有改變，會觸發重新安裝
    // Service Worker 永遠只會有一個 新的啟動了會把舊的踢掉，但是會等候舊的沒有控制任何資源時後才會刪掉

    // install 同時也是存快取的好地方，但是可能cache 到一半已經執行到 fetch，倒至沒抓完
    // 所以才要在加一個 waitUntil
    event.waitUntil(
        caches.open('static')
        .then(function(cache){
            cache.addAll([
                '/',
                '/index.html',
                '/favicon.ico',
                '/js/main.js'
            ]);  
        })  
    )
});


self.addEventListener('activate', function(event){
    console.log('[SW]: 觸發(Activate) Service Worker!',event);
    return self.clients.claim(); // 強制控制到沒有控制的資源
});

self.addEventListener('fetch', function(event){
    console.log('[SW] 抓資料(Fetch)!',event.request.url); // 當主要 JS 發送了 fetch 事件
    // 經常重整之後才會被觸發
    // 包括本身的HTML，icon、圖片、各種靜態資料 (HTML除外)、 所有外掛套件

    // event.respondWith(null); // 這個方法可以把 respond 替換掉
    // event.respondWith(
    //     caches.match(event.request)
    //         .then(function(response){
    //             //抓不到會拿到 null
    //             if(response){
    //                 return response;
    //             }else{
    //                 return fetch(event.request);
    //             }
    //         })
    // )
    // 在這邊也可以檢查剛才 caches 有沒有存好
});