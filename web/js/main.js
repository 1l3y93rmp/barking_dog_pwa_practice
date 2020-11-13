window.onload = function () {
  /* 宣告 DOM*/
  const conten = document.getElementById('conten')
  const send = document.getElementById('send')
  const wantToSay = document.getElementById('wantToSay')
  const pushButton = document.getElementById('pushButton')
  const installButton = document.getElementById('installButton')
  const closeSWButton = document.getElementById('closeSWButton')

  /* 公鑰 用於當 伺服器推送了資訊打包用*/
  const applicationServerPublicKey = 'BOacHYvnPWxVLwEyOzQCh1Vjl6KjjJkx3UGZkiP9DKqHzy_rxKVREqmfTPpvnkbBPPFy6DWzyvvbkQxWKecu_2k'

  /* 通用方法與 OBJ */
  let socket, swRegistration, addDB, readAllDB, deleteDBtext, isSubscribed, myBrowseris, isMob

  /* 測試瀏覽器 */
  function checkBrowser () {
    // Opera 8.0+
    let isOpera = (!!window.opr && !!opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0

    // Firefox 1.0+
    let isFirefox = typeof InstallTrigger !== 'undefined' || /FxiOS/.test(navigator.userAgent)

    // Safari 3.0+ "[object HTMLElementConstructor]" 
    let isSafari = /constructor/i.test(window.HTMLElement) || (function (p) { return p.toString() === '[object SafariRemoteNotification]'; })(!window['safari'] || (typeof safari !== 'undefined' && safari.pushNotification))

    // Internet Explorer 6-11
    let isIE = /*@cc_on!@*/false || !!document.documentMode

    // Edge 20+
    let isEdge = !isIE && !!window.StyleMedia

    // Chrome 1 - 71
    let isChrome = !!window.chrome || /CriOS/.test(navigator.userAgent)

    // 三星瀏覽器
    let isSamsung = navigator.userAgent.indexOf('Samsung') >= 0

    if (isOpera) {
      return 'isOpera'
    } else if (isFirefox) {
      return 'isFirefox'
    } else if (isSafari) {
      return 'isSafari'
    } else if (isIE) {
      return 'isIE'
    } else if (isEdge) {
      return 'isEdge'
    } else if (isChrome) {
      return 'isChrome'
    } else if (isSamsung) {
      return 'isSamsung'
    }
  }

  /* 測試裝置 */
  function checkMob () {
    const toMatch = [
      /Android/i,
      /webOS/i,
      /iOS/i,
      /FxiOS/i,
      /CriOS/i,
      /iPhone/i,
      /iPad/i,
      /iPod/i,
      /BlackBerry/i,
      /Windows Phone/i
    ]
    let isIOS = /iPad|iPhone|iPod/.test(navigator.platform) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

    return (toMatch.some((toMatchItem) => {
        return navigator.userAgent.match(toMatchItem)
      })) || isIOS

  // 因為 navigator.userAgent 沒辦法測出 ios 的 safari
  }

  /* 新增 DOM 文字方法 */
  function addElement (text) {
    let node = document.createTextNode(text) // 要準被塞入的文字
    let p = document.createElement('p')
    p.appendChild(node)
    conten.insertBefore(p, conten.childNodes[0])
  }

  /* 以下起動一個 WebSocket */
  function startSocket (resolve, reject, isReOpen) {
    // 註: startSocket 此涵式 必定會被 Promise 包覆調用，因此可使用 resolve, reject
    // 宣告創建時自動會連結 

    if (location.protocol === 'https:') {
      socket = new WebSocket('wss://pwa.trplus.com.tw:3004/websocket'); // 註: ssl 加密訪問於 3004 Port
    } else {
      socket = new WebSocket('ws://localhost:3003/websocket')
    }

    socket.onopen = e => {
      !isReOpen && resolve('WebSocket 打開啦!')
      isReOpen && promise_readAllDB_send() // 第一次的話被 init 做掉，所以重開的時候才要幫忙做
    }
    socket.onclose = e => {
      // 這裡在正是連上線之前會跑到這邊
      addElement(`系統訊息: 狗狗離線了，自動再取得連線中，您還是可以暫時使用離線功能唷`)
      !isReOpen && reject('WebSocket 關掉了...!', e)
      socket = null
      setTimeout(() => startSocket(null, null, true), 10000)
    }
    socket.onerror = e => {
      // console.log('WebSocket 出錯了...!', e)
    }
    socket.onmessage = e => {
      // console.log('WebSocket 有訊息傳來了', e)
      addElement(`狗狗說: ${e.data}`)

      // 在這支JS 內雖然可以執行 showNotification ，但是當這隻JS被關閉時是無法執行的。

      if (isSubscribed) {
        const title = '狗狗回應了你一些訊息:'
        const options = {
          body: e.data,
          icon: './images/icons-192.png',
          badge: './images/favicon.png',
          image: './images/dog.jpg',
          onclick: () => {
            window.open('https://www.trplus.com.tw/')}
        }
        // showNotification() 可以跳出提示視窗喔
        swRegistration.showNotification(title, options)
      }
    }
  }

  /* 用 Promise 方法包裹啟動 WebSocket 方法，並設定為初次調用 */
  const promise_startSocket = new Promise((resolve, reject) => {
    // 這裡是 init 被調用。第三個參數為 false
    startSocket(resolve, reject, false)
  })

  /* 以下起動一個 indexedDB */
  function startDB (resolve, reject) {
    // 註: startDB 此涵式 必定會被 Promise 包覆調用，因此可使用 resolve, reject
    const db = window.indexedDB.open('barkdb', 1)

    db.onerror = e => {
      resolve('db啟動失敗--')
    }

    db.onsuccess = e => {
      resolve('db啟動成功!')
    }

    db.onupgradeneeded = e => {
      console.log('db升級!'); // 當啟動的db版本比db實際號還新 

      // 在這裡新建倉庫 "Dialogue" 內放置對話記錄表單
      // 倉庫 > 表格 > 目次
      let objectStore = e.target.result.createObjectStore('dialogue', { autoIncrement: true })
      // 建立表格，第二個參數決定主Key，可自動生成
      objectStore.createIndex('text', 'text', { unique: false }); // 建立表格下面的目次
    // 參數: 目次名稱 / keyPath / 目次細節參數(這邊設定了不重複)
    }

    addDB = function (text) {
      let objectStore = db.result.transaction('dialogue', 'readwrite')
        .objectStore('dialogue')
        .add({ text: text })

      objectStore.onsuccess = (e) => {
        console.log('db寫入成功')
      }

      objectStore.onerror = (e) => {
        console.log('db寫入失敗')
      }
    }

    readAllDB = function (resolve_readAllDB, reject_readAllDB) { // 為了避免與外層 startDB 參數混淆
      let allDBtextArray = []
      let allDBkeyArray = []
      let objectStore = db.result.transaction('dialogue').objectStore('dialogue')

      objectStore.openCursor().onsuccess = e => {
        // 取資料一筆一筆是非同步的
        if (e.target.result) {
          allDBtextArray.push(e.target.result.value.text)
          allDBkeyArray.push(e.target.result.key)
          e.target.result.continue()
        } else {
          // console.log('沒有更多數據了')
          resolve_readAllDB({allDBtextArray: allDBtextArray, allDBkeyArray: allDBkeyArray})
        }
      }
    }

    deleteDBtext = function (key) {
      let objectStore = db.result.transaction('dialogue', 'readwrite')
        .objectStore('dialogue')
        .delete(key)
    }
  }

  /* 用 Promise 方法包裹啟動 indexedDB 方法 */
  const promise_startDB = new Promise((resolve, reject) => {
    startDB(resolve, reject)
  })

  /* 取得DB中離線處存的資料、成功後並送出，並刪除 */
  function promise_readAllDB_send () {
    // 將整個 readAllDB 使用 Promise 的操作包成一包
    const promise_readAllDB = new Promise((resolve_readAllDB, reject_readAllDB) => {
      readAllDB(resolve_readAllDB, reject_readAllDB)
    })
    promise_readAllDB
      .then((result_readAllDB) => {
        console.log('Promise(取得DB所有回應) 成功!', result_readAllDB)
        if (result_readAllDB.allDBkeyArray.length > 0) {
          result_readAllDB.allDBkeyArray.forEach(element => {
            deleteDBtext(element)
          })
          socket.send(result_readAllDB.allDBtextArray.toString()); // 終於可已對socket 送出!!
        }
      })
      .catch((error) => {
        console.log('第二次 Promise(取得DB所有回應) 失敗了', error)
      })
  }

  /* 在dom中秀出狗的圖片 */
  function showTheDogInDom (imgurl) {
    const dogPict = document.getElementById('dogPict')
    dogPict.setAttribute('src', imgurl)
  }

  /* 取得網路上一張隨機狗狗圖片 */
  function getDogimg () {
    fetch('https://dog.ceo/api/breeds/image/random')
      .then(function (response) {
        console.log('得到狗狗圖片')
        // fetch 會回傳一個包含 response 的 promise
        // 用 .json() 處理後要丟到下一個Then 才可以得到body內容
        return response.json()
      })
      .then(function (dogJson) {
        showTheDogInDom(dogJson.message)
      })
      .catch(function (err) {
        // 錯誤處理
        console.log('取得狗狗圖片出錯')
      })
  }

  /* 執行 serviceWorker proxy 代理 和 PushManager */
  function startSW (resolve, reject) {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      // 是否有支援 serviceWorker proxy 和 PushManager ? (目前大多瀏覽器有支援)
      // 註冊前，去向 Server取得 公鑰方可註冊
      let getPublicKeyUrl
      if (location.protocol === 'https:') {
        getPublicKeyUrl = 'https://localhost:3004/getpublicKey'
      } else {
        getPublicKeyUrl = 'http://localhost:3003/getpublicKey'
      }

      fetch(getPublicKeyUrl, { //跨預問題
        method: 'GET',
        crossDomain: true
      }).then(response=>{
        console.log(response)
      })
      navigator.serviceWorker.register('./service-worker.js')
        .then(function (swReg) { // 非同步
          resolve('Service Worker 註冊成功')
          swRegistration = swReg; // Service Worker 啟動成功後返回的"實體"，代表 SW 本身，可用它的方法產生 Token

          // SW 開啟後，在此綁定訂閱按鈕的操作
          subscribeUser()
          if ('PushManager' in window) {
            pushButton.onclick = () => {
              if (isSubscribed) {
                unsubscribeUser()
              } else {
                // 開始訂閱
                subscribeUser()
              }
            }
          } else {
            // SW 都開不起來的瀏覽器:
            pushButton.disabled = true
            pushButton.textContent = '很抱歉，您的瀏覽器或裝置目前不支援訂閱通知'
          }

          // 既然開好了也可以把他關掉
          closeSWButton.textContent = 'Service Worker 註冊成功, 按我可以把它關掉'
          closeSWButton.onclick = e => {
            swRegistration.unregister()
              .then(function(boolean) {
                if (boolean) {
                  closeSWButton.textContent = 'Service Worker 已經解除註冊，要等到她睡著才會自滅，重整將會再度自動開啟'
                }
              });
          }

        }).catch(function (error) {
        reject('Service worker 註冊失敗')
      })
    } else {
      // SW 都開不起來的瀏覽器:
      pushButton.disabled = true
      pushButton.textContent = '很抱歉，您的瀏覽器或裝置目前不支援SW，因此無法訂閱通知與離線瀏覽'
      reject('瀏覽器不支援 serviceWorker')
    }
  }

  /* promise 包裝 start sw Proxy */
  const promise_startSW = new Promise((resolve, reject) => {
    startSW(resolve, reject)
  })

  /* base64 網址安全編碼 轉換爲 UInt8Array*/
  function urlB64ToUint8Array (base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  function updateBtn () {
    if (isSubscribed) {
      // 有訂閱時 :
      pushButton.textContent = '太吵了，不再訂閱主動狗狗通知消息'
    } else {
      pushButton.textContent = '開始訂閱主動狗狗通知消息(開始列彈跳視窗提醒)'
    }
  }

  /* 開始訂閱吵鬧狗狗 (開始列跳出通知) 操作 */
  function subscribeUser () {
    if (typeof swRegistration.pushManager.subscribe === 'function') { // 檢查那些不能訂閱的瀏覽器
      const applicationServerKey = urlB64ToUint8Array(applicationServerPublicKey); // 轉換成二進位的公鑰

      // subscribe() 方法: 瀏覽器會顯示彈出框通確認是否要訂閱，由於訂閱是使 SW 開始接收訊息，所以方法放在 SW 實體上面
      swRegistration.pushManager.subscribe({ // 給 sw 註冊: 要訂閱了!
        userVisibleOnly: true, // 表示授權 允許Server 傳資料過來時，可以顯現小彈窗
        applicationServerKey: applicationServerKey // Server直接来向客户端应用发送消息用的打包公鑰
      })
        .then(function (subscription) {
          console.log('User 開始訂閱吵鬧狗狗了:')
          console.log(JSON.stringify(subscription))
          // 可以看到endpoint 終點是 google FCM 服務
          // subscription 如同這個APP 的身分證，讓 FCM 服務 可以找到我們的 APP
          // 操做法: 將 JSON.stringify(subscription) 產出的字串貼到 FCM https://web-push-codelab.glitch.me/ 服務即可發送測試

          isSubscribed = true
          updateBtn(isSubscribed)
        })
        .catch(function (err) {
          console.log('訂閱吵鬧狗狗失敗: ', err)
          isSubscribed = false
          updateBtn(isSubscribed)
        })
    } else {
      pushButton.disabled = true
      pushButton.textContent = '很抱歉，您的瀏覽器不支援訂閱主動通知消息!'
    }
  }

  /* 停止訂閱~ */
  function unsubscribeUser () {
    swRegistration.pushManager.getSubscription() // getSubscription 返回Promise，可取得當前現有的訂閱
      .then(function (subscription) {
        if (subscription) {
          return subscription.unsubscribe()
        }
      })
      .catch(function (error) {
        console.log('停止訂閱出錯了', error)
      })
      .then(function () {
        // 註: unsubscribe 並非 "封鎖" 通知，而是停止，在瀏覽器上看到的仍然會是"允許"，只是JS無法在產生通知給使用者
        console.log('使用者停止訂閱了~')
        isSubscribed = false

        updateBtn()
      })
  }

  /* 檢查是否已經安裝，改變按鈕 */
  function chackIntallState () {
    let deferredPrompt
    window.addEventListener('beforeinstallprompt', e => {
      console.log('beforeinstallprompt，安裝之前觸發')
      // beforeinstallprompt 只要沒安裝都會觸發`, 在此確認狀態
      // 這裡當做檢查處，當執行了 deferredPrompt.prompt() 如果仍未安裝，這裡也會執行
      e.preventDefault()
      deferredPrompt = e
      installButton.disabled = false
      installButton.textContent = '點我在桌面安裝狗狗App'
    })

    window.addEventListener('appinstalled', e => {
      // 剛安裝完，這裡會觸發
      // 已經安裝了 重整這裡不會觸發.............因此重整的情況靠下方的 setTimeout
      console.log('appinstalled，安裝之後觸發')
      installButton.disabled = true
      installButton.textContent = '謝謝，您已安裝過狗狗APP'
    })

    installButton.addEventListener('click', (e) => {
      if (deferredPrompt) { // 當 deferredPrompt 有值才可以按~
        deferredPrompt.prompt()
        deferredPrompt.userChoice
          .then(choiceResult => {
            if (choiceResult.outcome === 'accepted') {
              installButton.disabled = true
              installButton.textContent = '謝謝，您已安裝過狗狗APP'
            } else {
              console.log('使用者未確認安裝')
            }
            deferredPrompt = null // 要加這個，不然 prompt() 方法只能用一次
          })
      } else {
        console.log('已安裝 或不支援點擊安裝 ^_^b')
      }
    })

    // 等候500毫秒 若 beforeinstallprompt 沒有被處發 deferredPrompt 必定為空
    // 表示 1.已安裝過 2.不支援這個事件(目前除了 Chropme 瀏覽器 都不支援)
    // https://caniuse.com/#search=BeforeInstall

    setTimeout(() => {
      console.log(myBrowseris)
      if (deferredPrompt === undefined) {
        if (navigator.platform !== 'MacIntel') {
          if (myBrowseris === 'isChrome') {
            installButton.textContent = '謝謝，您已安裝過狗狗APP'
          } else if ((myBrowseris === 'isFirefox' && isMob) || (myBrowseris === 'isSafari' && isMob) || myBrowseris === 'isSamsung') {
            // 不支援 beforeinstallprompt / appinstalled 事件，但可安裝之情況
            installButton.disabled = true
            installButton.textContent = '很抱歉，您的瀏覽器目前還不支援點擊後自動安裝APP，若您尚未安裝，可手動在瀏覽器畫面右上角執行手動安裝加入主畫面'
          } else {
            // 無法安裝的情況
            installButton.disabled = true
            installButton.textContent = '很抱歉，您的瀏覽器或裝置目前不支援安裝APP(其他瀏覽器)'
          }
        } else {
          // 無法安裝的情況 (無論何種瀏覽器，在Ipad IPhone 都不行)
          installButton.disabled = true
          installButton.textContent = '很抱歉，您的瀏覽器或裝置目前不支援安裝APP(MacIntel)'
        }
      }
    }, 500)
  }

  /* 初始化 */
  function init () {

    // 得知當前瀏覽器為:
    myBrowseris = checkBrowser()

    // 得知當前的裝置為:
    isMob = checkMob()

    /* 啟動 SW Proxy */
    promise_startSW
      .then(result => {
        // console.log(result)
        /*startSW 成功後，檢查 訂閱 SW Proxy 事件*/
        swRegistration.pushManager.getSubscription() // getSubscription 返回Promise，可取得當前現有的訂閱
          .then(function (subscription) {
            // 每當重啟的時候
            isSubscribed = !(subscription === null); // 返回布林

            if (isSubscribed) {
              console.log('User 之前有訂閱吵鬧狗狗提醒')
            } else {
              console.log('User 之前沒訂閱吵鬧狗狗提醒')
            }
          })
      })
      .catch(error => {
        console.log(error)
      })

    /* 確認 APP 安裝情況 */
    chackIntallState()

    /* 綁定送出按鈕事件&操作 */
    send.onclick = (e) => {
      e.preventDefault()
      let wantToSayTex = wantToSay.value
      if (!!socket == false) {
        // socket掉線...
        addElement(`你說: ${wantToSayTex} [對方離線中...]`)
        // 以下操作儲存 indexedDB
        addDB(wantToSayTex)
      } else {
        if (socket.readyState === 1) {
          socket.send(wantToSayTex)
          addElement(`你說: ${wantToSayTex}`)
        } else {
          addElement(`你說: ${wantToSayTex} [對方離線中...]`)
          addDB(wantToSayTex)
        }
      }
      wantToSay.value = ''
    }

    /* init時 使用 Promise 等候 DB啟動OK  & Socket連線OK */
    Promise.all([promise_startSocket, promise_startDB])
      .then((result) => {
        // 還需 再次等候 DB取得資料OK ,
        console.log('DB啟動OK && Socket連線OK', result)
        promise_readAllDB_send()
      })
      .catch((error) => {
        console.log('第一次 Promise 失敗了', error)
      })

    /* 取得小狗圖片 */
    getDogimg()
  }

  init()
}
