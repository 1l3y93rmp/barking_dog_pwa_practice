// service-worker 也稱 SW
// 等同該網域下專用的 Proxy，這裡的 Console 可以傳到網站 (網站頁面未開時，也可以在 chrome://serviceworker-internals/ 看到)
// 即便網頁關閉了，SW 也能執行，因此可以協助接收一些資料(Push)
// 註: 但是至少瀏覽器要開著，分頁不用開
// 這個檔案有改變(字節比對) 可使用強制新整理(SW 不會重開)，
// WS 只有在新建立 收到訊息(push) 或是下載東西(fetch)的時候是活的，其於時間待機
// 安裝後，至少24小時內會此JS會被重新下載、安裝，醒來
// 手動刪除要等很久(就算是從控制台刪也一樣)

// 更多詳細說明:
// https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API

console.log(self) // 指的是 worker global scope
const CACHE_VERSION = 55; // 以後每次 動態快取 static & dynamic 快取住的 檔案有更新，記得來這邊改版本號，不然會卡舊的檔案
// 同時，也會造成重新安裝 SW

// 下面是很多的事件偵聽
self.addEventListener('install', function (event) {
  // 第一次裝好了之後就會一直開著，因此重開網頁是不會觸發安裝的

  // 一個網域的 SW 永遠只會有一個 新的安裝了後會等候 "舊的沒有控制任何資源" 時後，才會正式醒來

  // 靜態快取存快取的好地方，但是可能cache 到一半已經執行到 fetch，倒至沒抓完
  // waitUntil 避免已嵌執行到 fetch 還沒抓完
  event.waitUntil(
    caches.open('static_' + CACHE_VERSION) // 預先快取"固定"要使用的資源，快取可以有好幾個陣列 此陣列叫 static
      .then(function (cache) { // 這裡放的是一些固定不變的資源，至會變的要存到叫 dynamic 的動態快取裡
        console.log('[SW]: 成功安裝(Install) Service Worker!，運行CACHE_VERSION為:' + CACHE_VERSION, event)
        cache.addAll([
          '/',
          '/index.html',
          '/favicon.ico',
          '/manifest.json',
          '/images/dog.jpg',
          '/images/icons-192.png',
          '/images/icons-512.png'
        ])
      })

  // 靜態快取比較快成立
  )
})

self.addEventListener('activate', function (event) {
  console.log('[SW]: 從待機中醒來(Activate)', event)
  // 這裡是若 SW 安裝過後一陣子沒操作，會自動待機，這裡是重新醒來的事件
  // 醒來的時機: 1. 睡著的 2.安裝好之後、管轄的網頁被載入時，收到 Push 時
  // 因為醒著的時間有時候很久所以 這裡不會被觸發.........

  // 在此時機，可檢查快取清單"名稱"是否有更新
  event.waitUntil(
    caches.keys() // 取得所有快取清單 ( static、dynamic)
      .then(function (cacheNames) {
        return Promise.all(
          cacheNames.filter(function (cacheName) {
            let cachesKeyVersion = parseInt(cacheName.slice(cacheName.indexOf('_') + 1))
            return (cachesKeyVersion < CACHE_VERSION) // 篩選出當前版號比現在小的
          }).map(function (cacheName) {
            console.log(cacheName + '要被刪掉囉!')
            return caches.delete(cacheName) // 都要被刪掉
          })

        )
      })
  )

  return self.clients.claim(); // 強制控制該網域下所有可造訪的的網址( 如果沒有設定的話，只有JS 有調用的才會被控制 )
})

self.addEventListener('fetch', function (event) {
  console.log('[SW] 抓資料(Fetch)!', event.request.url)
  // fetch 事件，下載資料事件
  // 包括本身的HTML，icon、圖片、各種靜態資料、 所有外掛套件
  // 第一次載入的時候不一定會觸發到，因為 SW開始運作與 fetch事件綁定太慢，下載已完成

  event.respondWith(
    caches.match(event.request) // caches.match , 當"所有"快取中有對應到當前的 request 就執行以下 (用Then 非同步的)
      .then(function (response) { // 這個 response 指的是快取撈出來的 response，撈不到會拿到 nul
        if (response) {
          console.log('我有暫存' + event.request.url)
          return response; // 任何表 有撈到到就返回 快取撈出來的 response
        }else {
          if (event.request.url.indexOf('.js') > 0) {
            // 註: 凡只要 .js 會掉到這邊才被存入 dynamic 動態快取
            // console.log('沒站存 存到 dynamic 動態快取!!!'+ event.request.url)
            return fetch(event.request) // 先執行去抓取
              .catch(function (res) { // catch 接續工作 取得 res (fetch 得到的物件) (勿用 Then)
                caches.open('dynamic_' + CACHE_VERSION) // 快取 開啟新的 dynamic cache
                  .then(function (cache) { // 開啟後的才能取得 cache
                    console.log('[SW] 建立新的 dynamic 動態快取 CACHE_VERSIO N為:' + CACHE_VERSION)
                    // console.log('塞進 dynamic 動態快取')
                    cache.put(event.request.url, res.clone()); // 塞入一個複製的
                  })
              })
          } else {
            // 隨機狗狗圖片 & API 則設定不存到任何快取中
            // console.log('沒站存 以後也不想存!!!')
            return fetch(event.request)
          }
        }
      })
  )
})

self.addEventListener('push', function (event) {
  // 當 伺服器 推送訊息給瀏覽器時，可以從這個事件事件取得相關資訊
  // 由於 webSocket 的連線沒有被 service-worker

  console.log('[SW] 伺服器推送了一個資訊過來!')
  console.log(`[SW] 伺服器推送來內容是: "${event.data.text()}"`)
  const title = '狗狗從伺服器發送了一個訊息過來'

  let messageObj = event.data.text();
  try {
    messageObj = JSON.parse(event.data.text()).message; // 如果Server 傳來的不是字串的 JSON
  } catch (e) {
    console.log('[SW] Server 傳來的是字串的 JSON，無法 JSON.parse', e)
  }

  const options = {
    body: messageObj,
    icon: 'images/icons-192.png',
    badge: 'images/favicon.png',
    image: 'images/dog.jpg'
  }
  // 在畫面 showNotification，
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  console.log('[SW] 點擊通知小框框 發生!', event)

  const clickedNotification = event.notification
  clickedNotification.close()

  event.waitUntil(clients.matchAll({ // matchAll 返回迭代器OBJ，參數為條件
    type: 'window'
  }).then(function (clientList) {
    console.log(clientList)
    if (clientList.length === 0) {
      console.log('[SW] 託管的視窗皆未開')
      return clients.openWindow('/')
    } else {
      console.log('[SW] 視窗有開')
      return clientList[0].focus()
    }
  }))
})
