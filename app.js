/* ============ 기본 유틸 / 로컬스토리지 키 ============ */
const LS = {
  posts: 'eco_posts_v1',
  user: 'eco_user_v1',
  carbon: 'eco_carbon_v1'
};

/* ============ 앱 상태 초기화 ============ */
let posts = JSON.parse(localStorage.getItem(LS.posts) || '[]');
let user = JSON.parse(localStorage.getItem(LS.user) || 'null');
let carbon = JSON.parse(localStorage.getItem(LS.carbon) || '[]');

/* ============ DOM 레퍼런스 ============ */
const pages = document.querySelectorAll('.page');
document.querySelectorAll('.nav-btn').forEach(btn=>{
  btn.addEventListener('click', ()=> {
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    goPage(btn.dataset.page);
  });
});

/* ============ 페이지 전환 ============ */
function goPage(id){
  pages.forEach(p=>p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if(id === 'map') setTimeout(()=>{ map.invalidateSize(); },300); // leaflet 재조정
  if(id === 'carbon') drawCarbonChart();
  renderPosts();
  renderMyPosts();
  renderUser();
}

/* ============ 로그인(간단) ============ */
const loginBtn = document.getElementById('loginBtn');
loginBtn.addEventListener('click', ()=>{
  let name = user && user.name ? user.name : prompt('닉네임을 입력하세요 (익명 허용):','');
  if(name === null) return;
  user = {name: name || '익명', created: Date.now()};
  localStorage.setItem(LS.user, JSON.stringify(user));
  renderUser();
});
function renderUser(){
  const lbl = document.getElementById('userLabel');
  if(user && user.name) lbl.textContent = `안녕하세요, ${user.name}`;
  else lbl.textContent = '비회원';
}

/* ============ 오늘의 실천 / 계산 ============ */
const actions = ["대중교통 이용하기","텀블러 사용하기","플라스틱 줄이기","10분 줍기","잔반 줄이기"];
document.getElementById('actionBtn').addEventListener('click', ()=>{
  const a = actions[Math.floor(Math.random()*actions.length)];
  document.getElementById('actionBox').textContent = a;
});
document.getElementById('calcBtn').addEventListener('click', ()=>{
  const bus = Number(document.getElementById('calc_bus').value || 0);
  const elec = Number(document.getElementById('calc_elec').value || 0);
  const total = bus*0.003 + elec*0.5;
  document.getElementById('calcResult').textContent = `예상 배출량(오늘): ${total.toFixed(2)} kg CO₂`;
});

/* ============ 게시글(이미지/파일 포함) ============ */
const postBtn = document.getElementById('postBtn');
postBtn.addEventListener('click', async ()=>{
  const title = document.getElementById('postTitle').value.trim();
  const text = document.getElementById('postText').value.trim();
  if(!text){ alert('내용을 입력하세요'); return; }

  // 이미지 파일 처리 (base64)
  const imgInput = document.getElementById('postImage');
  const fileInput = document.getElementById('postFile');
  const imageData = imgInput.files[0] ? await fileToBase64(imgInput.files[0]) : null;
  const fileData = fileInput.files[0] ? { name: fileInput.files[0].name, data: await fileToBase64(fileInput.files[0]) } : null;

  const newPost = {
    id: Date.now(),
    title,
    text,
    image: imageData,
    file: fileData,
    region: document.getElementById('postRegion').value || '',
    category: document.getElementById('postCategory').value || '일반',
    author: user && user.name ? user.name : '익명',
    time: new Date().toLocaleString(),
    likes: 0,
    reports: 0,
    comments: []
  };
  posts.unshift(newPost);
  localStorage.setItem(LS.posts, JSON.stringify(posts));
  // 초기화
  document.getElementById('postTitle').value = '';
  document.getElementById('postText').value = '';
  document.getElementById('postImage').value = '';
  document.getElementById('postFile').value = '';
  renderPosts();
  // 마커 추가
  if(newPost.region) addMarkerForPost(newPost);
});

/* 파일 -> base64 */
function fileToBase64(file){
  return new Promise((res, rej)=>{
    const fr = new FileReader();
    fr.onload = ()=>res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

/* ============ 렌더: 게시글 목록 ============ */
function renderPosts(){
  const box = document.getElementById('postList');
  box.innerHTML = '';
  let list = [...posts];
  const sort = document.getElementById('sortSelect').value;
  if(sort === 'like') list.sort((a,b)=>b.likes-a.likes);
  list.forEach((p,i)=>{
    const el = document.createElement('div');
    el.className = 'postItem card';
    el.innerHTML = `
      <strong>${p.title || '(제목없음)'}</strong>
      <div>${escapeHtml(p.text)}</div>
      ${p.image ? `<img src="${p.image}" class="postImg">` : ''}
      ${p.file ? `<div class="muted">첨부: <a href="${p.file.data}" download="${p.file.name}">${p.file.name}</a></div>` : ''}
      <div class="postMeta">작성: ${p.author} · ${p.time} · 지역: ${p.region || '전체'} · 카테고리: ${p.category}</div>
      <div style="margin-top:8px">
        <button onclick="likePost(${p.id})">❤ ${p.likes}</button>
        <button onclick="reportPost(${p.id})">신고 (${p.reports})</button>
        <button onclick="saveToMy(${p.id})">저장</button>
        <button onclick="deletePost(${p.id})">삭제</button>
      </div>
      <div style="margin-top:8px">
        <div>${p.comments.map(c=>`<div class="muted">💬 ${escapeHtml(c)}</div>`).join('')}</div>
        <input id="c_${p.id}" placeholder="댓글 입력">
        <button onclick="addComment(${p.id})">댓글</button>
      </div>
    `;
    box.appendChild(el);
  });
}

/* helper escape */
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

/* ============ 게시글 액션 ============ */
function findPostIndex(id){ return posts.findIndex(p=>p.id===id); }
function likePost(id){
  const idx = findPostIndex(id);
  if(idx>=0) posts[idx].likes++;
  localStorage.setItem(LS.posts, JSON.stringify(posts));
  renderPosts();
}
function reportPost(id){
  const idx = findPostIndex(id);
  if(idx>=0){
    posts[idx].reports++;
    alert('신고 접수되었습니다. 관리자가 확인할 수 있습니다.');
  }
  localStorage.setItem(LS.posts, JSON.stringify(posts));
  renderPosts();
}
function deletePost(id){
  const idx = findPostIndex(id);
  if(idx>=0){
    if(confirm('정말 삭제할까요?')) posts.splice(idx,1);
    localStorage.setItem(LS.posts, JSON.stringify(posts));
    renderPosts();
    renderMyPosts();
  }
}
function addComment(id){
  const input = document.getElementById('c_'+id);
  if(!input) return;
  const txt = input.value.trim();
  if(!txt) return;
  const idx = findPostIndex(id);
  if(idx>=0){
    posts[idx].comments.push(txt);
    localStorage.setItem(LS.posts, JSON.stringify(posts));
    renderPosts();
    input.value = '';
  }
}
function saveToMy(id){
  const idx = findPostIndex(id);
  if(idx>=0){
    const myPosts = JSON.parse(localStorage.getItem('eco_my_posts')||'[]');
    myPosts.unshift(posts[idx]);
    localStorage.setItem('eco_my_posts', JSON.stringify(myPosts));
    renderMyPosts();
    alert('내글에 저장되었습니다.');
  }
}

/* ============ 마이페이지 렌더 ============ */
function renderMyPosts(){
  const box = document.getElementById('myPosts');
  const my = JSON.parse(localStorage.getItem('eco_my_posts')||'[]');
  box.innerHTML = my.length ? my.map(p=>`<div class="card">${escapeHtml(p.title||'(제목없음)')}<div class="muted">${p.time}</div></div>`).join('') : '<div class="muted">저장한 글이 없습니다.</div>';
}

/* ============ 지도 (Leaflet) ============ */
const map = L.map('map').setView([36.5, 127.7], 7);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
let markers = [];
function addMarkerForPost(post){
  // 임의 좌표 매핑 (지역별 대표 좌표)
  const coords = {
    '서울':[37.5665,126.9780],'경기':[37.4138,127.5183],'인천':[37.4563,126.7052],
    '부산':[35.1796,129.0756],'대구':[35.8714,128.6014],'광주':[35.1595,126.8526],
    '대전':[36.3504,127.3845],'울산':[35.5384,129.3114],'세종':[36.4800,127.2890],
    '강원':[37.8882,127.7293],'충북':[36.6356,127.4910],'충남':[36.5184,126.8],
    '전북':[35.7175,127.1530],'전남':[34.8172,126.4623],'경북':[36.4919,128.8889],
    '경남':[35.4606,128.2132],'제주':[33.4890,126.4983]
  };
  const coord = coords[post.region] || [36.5,127.7];
  const m = L.marker(coord).addTo(map).bindPopup(`<b>${escapeHtml(post.title||'제목없음')}</b><br>${escapeHtml(post.text)}`);
  markers.push(m);
}
function loadMarkers(){
  // 초기화: 기존 포스트 중 지역 지정된 것들
  posts.forEach(p=> { if(p.region) addMarkerForPost(p); });
}
loadMarkers();

/* ============ 탄소 기록 & Chart.js ============ */
const carbonCtx = document.getElementById('carbonChart').getContext('2d');
let carbonChart = null;
function drawCarbonChart(){
  const data = carbon.slice(-14); // 최근 14일치(예시)
  const labels = data.map((_,i)=>`#${i+1}`);
  if(carbonChart) carbonChart.destroy();
  carbonChart = new Chart(carbonCtx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'kg CO₂', data, backgroundColor: '#2f855a' }]
    },
    options: { responsive:true, maintainAspectRatio:false }
  });
}
document.getElementById('carbonAdd').addEventListener('click', ()=> {
  const v = Number(document.getElementById('carbonVal').value || 0);
  if(!v && v!==0) return;
  carbon.push(v);
  localStorage.setItem(LS.carbon, JSON.stringify(carbon));
  document.getElementById('carbonVal').value = '';
  drawCarbonChart();
  updateBadges();
});

/* ============ 뱃지 시스템 ============ */
function updateBadges(){
  const box = document.getElementById('userBadges');
  box.innerHTML = '';
  const total = carbon.reduce((a,b)=>a+b,0);
  if(total >= 10) box.innerHTML += '<span class="badge">10kg 절감</span>';
  if(posts.length >= 3) box.innerHTML += '<span class="badge">활동왕</span>';
}
updateBadges();

/* ============ 초반 렌더 ============ */
renderUser();
renderPosts();
renderMyPosts();
drawCarbonChart();

/* ============ 정렬/다크모드/닉네임 저장 ============ */
document.getElementById('sortSelect').addEventListener('change', renderPosts);
document.getElementById('modeToggle').addEventListener('click', ()=>{
  document.body.classList.toggle('dark');
});
document.getElementById('saveNick').addEventListener('click', ()=>{
  const nick = document.getElementById('nickname').value.trim();
  if(!nick) return alert('닉네임을 입력하세요');
  user = user || {};
  user.name = nick;
  localStorage.setItem(LS.user, JSON.stringify(user));
  renderUser();
});

/* ============ 유틸: 게시물 좌표 초기 load (이미 처리) ============ */

/* EOF */
