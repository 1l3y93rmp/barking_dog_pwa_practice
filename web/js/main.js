window.onload = function () {

  /* 宣告 DOM*/
  const conten = document.getElementById('conten')
  const send = document.getElementById('send')
  const wantToSay = document.getElementById('wantToSay')
  const pushButton = document.getElementById('pushButton')

  /* 公鑰 用於當 伺服器推送了資訊打包用*/
  const applicationServerPublicKey = 'BOacHYvnPWxVLwEyOzQCh1Vjl6KjjJkx3UGZkiP9DKqHzy_rxKVREqmfTPpvnkbBPPFy6DWzyvvbkQxWKecu_2k';

  /* 通用方法與 OBJ */
  let socket, swRegistration, addDB, readAllDB, deleteDBtext, isSubscribed;

  /* 新增 DOM 文字方法 */
  function addElement (text) {
    let node = document.createTextNode(text) // 要準被塞入的文字
    let p = document.createElement('p')
    p.appendChild(node)
    conten.insertBefore(p,conten.childNodes[0])
  }

  /* 以下起動一個 WebSocket */
  function startSocket (resolve, reject, isReOpen) {
    // 註: startSocket 此涵式 必定會被 Promise 包覆調用，因此可使用 resolve, reject
    // 宣告創建時自動會連結 

    if ( location.protocol === 'https:' ){
      socket = new WebSocket('wss://pwa.trplus.com.tw:3004');  // 註: ssl 加密訪問於 3004 Port
    } else {
      socket = new WebSocket('ws://localhost:3003'); 
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
          icon: 'images/icons-192.png',
          badge: 'images/icons-192.png',
          image: 'images/dog.jpg'
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
      let objectStore = event.target.result.createObjectStore('dialogue', { autoIncrement: true })
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
  function startProxy (resolve, reject) {
    if ('serviceWorker' in navigator && 'PushManager' in window) { // 是否有支援 serviceWorker proxy 和 PushManager ?
      navigator.serviceWorker
        .register('/service-worker.js')
        .then(function (swReg) { // 非同步
          resolve('Service Worker 註冊成功')
          swRegistration = swReg; // Service Worker proxy 啟動成功後返回的實體
          console.log(swRegistration)
          subscribeUser(); // 這樣 Service Worker proxy 也可被訂閱

        }).catch(function (error) {
        reject('Service worker 註冊失敗')
      })
    } else {
      reject('瀏覽器不支援...')
    }
  }

  /* promise 包裝 start sw Proxy */
  const promise_startProxy = new Promise((resolve, reject) => {
    startProxy(resolve, reject)
  })

  /* base64 網址安全編碼 轉換爲 UInt8Array*/
  function urlB64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  function updateBtn() {
    if (isSubscribed) {
      // 有訂閱時 :
      pushButton.textContent = '太吵了，不再訂閱吵鬧狗狗';
    } else {
      pushButton.textContent = '開始訂閱吵鬧狗狗(開始列彈跳視窗提醒)';
    }
    // pushButton.disabled = false; // 暫時關掉
  }

  /* 開始訂閱吵鬧狗狗 (開始列跳出通知) 操作 */
  function subscribeUser() {
    const applicationServerKey = urlB64ToUint8Array(applicationServerPublicKey); // 公鑰

    // subscribe() 方法: 會顯示彈出框通確認是否要訂閱，由於是否訂閱的狀態是放在 SW Proxy 的，所以方法放在 sw 上面
    // 註: 當網頁或APP是關掉的時候是不會有訊息提示的
    swRegistration.pushManager.subscribe({ // 給 sw 註冊: 要訂閱了!
      userVisibleOnly: true, // 表示授權 允許Server 傳資料過來時，可以顯現小彈窗
      applicationServerKey: applicationServerKey // Server直接来向客户端应用发送消息用的打包公鑰
    })
    .then(function(subscription) {
      console.log('User 開始訂閱吵鬧狗狗了:', subscription.endpoint);
      console.log(JSON.stringify(subscription))
      // 可以看到endpoint 終點是 google FCM 服務
      // subscription 如同這個APP 的身分證，讓 FCM 服務 可以找到我們的 APP
      // 操做法: 將 JSON.stringify(subscription) 產出的字串貼到 FCM https://web-push-codelab.glitch.me/ 服務即可發送測試

      isSubscribed = true
      updateBtn(isSubscribed);
    })
    .catch(function(err) {
      console.log('訂閱吵鬧狗狗失敗: ', err);
      isSubscribed = false
      updateBtn(isSubscribed);
    });
  }



  /* 停止訂閱~ */
  function unsubscribeUser() {
    swRegistration.pushManager.getSubscription()
    .then(function(subscription) {
      if (subscription) {
        return subscription.unsubscribe();
      }
    })
    .catch(function(error) {
      console.log('停止訂閱出錯了', error);
    })
    .then(function() {
      console.log('使用者停止訂閱了~');
      isSubscribed = false;

      updateBtn();
    });
  }

  /* 初始化 */
  function init () {
    promise_startProxy
      .then(result => {
        console.log(result)
        /*startProxy 成功後，檢查 訂閱 SW Proxy 事件*/
        swRegistration.pushManager.getSubscription()
        .then(function(subscription) {
          // 每當重啟的時候
          isSubscribed = !(subscription === null); // 返回布林

          if (isSubscribed) {
            console.log('User 之前有訂閱吵鬧狗狗提醒');
          } else {
            console.log('User 之前沒訂閱吵鬧狗狗提醒');
          }
          updateBtn();
        });
      })
      .catch(error => {
        console.log(error)
      })

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

    /* 綁定註冊吵鬧小狗按鈕 */
    pushButton.onclick = () => {
      if (isSubscribed) {
        unsubscribeUser();
      } else {
        // 開始訂閱
        subscribeUser();
      }
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
