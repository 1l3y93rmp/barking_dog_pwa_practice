window.onload = function () {
  /* 執行 proxy 代理 */
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

  /* 宣告 DOM*/

  const conten = document.getElementById('conten')
  const send = document.getElementById('send')
  const wantToSay = document.getElementById('wantToSay')
  let socket, addDB , readAllDB, deleteDB;

  /* 新增 DOM 文字方法 */
  function addElement (text) {
    let node = document.createTextNode(text) // 要準被塞入的文字
    let p = document.createElement('p')
    p.appendChild(node)
    conten.appendChild(p)
  }

  /* 以下起動一個 WebSocket */
  function startSocket () {
    socket = new WebSocket('ws://localhost:3000'); // 創建時自動會連結
    socket.onopen = e => {
      console.log('WebSocket 打開啦!', e)
      // 每當打開的時候都檢查一次indexedDB 有沒有離線儲存的對話，要重新發送

      // 這件事情要等 Socket & DB 都啟動好了才可以做，所以用 Promise 寫吧
     
      socket.send(readAllDB())
    }
    socket.onclose = e => {
      // 這裡在正是連上線之前會跑到這邊
      console.log('WebSocket 關掉了...!', e)
      addElement(`系統訊息: 狗狗離線了，自動再取得連線中，您還是可以暫時使用離線功能唷`)
      socket = null
      setTimeout(startSocket, 10000)
    }
    socket.onerror = e => {
      // console.log('WebSocket 出錯了...!', e)
    }
    socket.onmessage = e => {
      console.log('WebSocket 有訊息傳來了', e)
      addElement(`狗狗說: ${e.data}`)
    }
  }
  startSocket()

  /* 以下起動一個 indexedDB */
  function startDB() {
    const db = window.indexedDB.open('barkdb', 1);

    db.onerror = e => {
      console.log('db啟動失敗--');
    };

    db.onsuccess = e => {
      console.log('db啟動成功!')
      console.log( db ) // 包括各種 DB 的方法
      console.log( db.result ) // DB 實體 (IDBDatabase)
    }

    db.onupgradeneeded = e => {
      console.log('db升級!'); //當啟動的db版本比db實際號還新 
      
      // 在這裡新建倉庫 "Dialogue" 內放置對話記錄表單
      // 倉庫 > 表格 > 目次
      let objectStore = event.target.result.createObjectStore('dialogue', { autoIncrement: true })
      //建立表格，第二個參數決定主Key，可自動生成
      objectStore.createIndex('text', 'text', { unique: false }); //建立表格下面的目次
      // 參數: 目次名稱 / keyPath / 目次細節參數(這邊設定了不重複)
    }

    addDB = function (text) {
      let objectStore = db.result.transaction('dialogue', 'readwrite')
        .objectStore('dialogue')
        .add({ text: text });
      
      objectStore.onsuccess = (e) => {
        console.log('db寫入成功');
      };

      objectStore.onerror = (e) => {
        console.log('db寫入失敗');
      }
    }
    
    readAllDB = function () {
      let allDBtextArray = [];
      let objectStore = db.result.transaction('dialogue').objectStore('dialogue')
      
      objectStore.openCursor().onsuccess = e => {
        // 取資料一筆一筆是非同步的
        if (e.target.result) {
          console.log(e.target.result.value.text)
          allDBtextArray.push(e.target.result.value.text)
          e.target.result.continue()
        } else {
          console.log('沒有更多數據了')
          console.log(allDBtextArray)// 還是空陣列就被Return 了!!!
          allDBtextArray = allDBtextArray.toString()
          return allDBtextArray
        }
      }
    }
  };
  startDB();

  /* 綁定送出按鈕事件&操作 */
  send.onclick = (e) => {
    e.preventDefault();
    let wantToSayTex = wantToSay.value;
    if (!!socket == false) {
      // socket掉線...
      addElement(`你說: ${wantToSayTex} [對方離線中...]`);
      // 以下操作儲存 indexedDB
      addDB(wantToSayTex);
      
    } else {
      if (socket.readyState === 1) {
        socket.send(wantToSayTex)
        addElement(`你說: ${wantToSayTex}`)
      } else {
        addElement(`你說: ${wantToSayTex} [對方離線中...]`);
        addDB(wantToSayTex);
      }
    }
    wantToSay.value = ''
  }

  



  /* 取得網路上一張隨機狗狗圖片 */
  function showTheDogInDom (imgurl) {
    const dogPict = document.getElementById('dogPict')
    dogPict.setAttribute('src', imgurl)
  }

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
      console.log('狗狗圖片出錯')
    })
}
