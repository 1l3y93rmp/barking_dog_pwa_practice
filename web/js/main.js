window.onload = function () {

  /* 宣告 DOM*/
  const conten = document.getElementById('conten')
  const send = document.getElementById('send')
  const wantToSay = document.getElementById('wantToSay')

  /* 通用方法 */
  let socket, addDB, readAllDB, deleteDBtext

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
      socket = new WebSocket('wss://10.101.205.226:3004');  // 註: 由於內網為浮動IP , ssl 加密訪問於 3004 Port
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

  /* 執行 proxy 代理 */
  function startProxy () {
    if ('serviceWorker' in navigator) { // 是否有支援 ?
      navigator.serviceWorker
        .register('/service-worker.js')
        .then(function () { // 非同步使用Call back
          console.log('Service Worker 註冊成功')
        }).catch(function (error) {
        console.log('Service worker 註冊失敗:', error)
      })
    } else {
      console.log('瀏覽器不支援...')
    }
  }

  /* 初始化 */
  function init () {
    startProxy()

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
