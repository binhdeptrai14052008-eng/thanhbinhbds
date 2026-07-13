import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { firebaseConfig, COLLECTION_NAME } from "../js/firebase-config.js";

const app=initializeApp(firebaseConfig); const db=getFirestore(app);
const labels={"dat-nen":"Đất nền","nha-pho":"Nhà phố","can-ho":"Căn hộ","nha-vuon":"Nhà vườn","dat-nong-nghiep":"Đất nông nghiệp","nghi-duong":"BĐS nghỉ dưỡng","du-an":"Dự án"};
const statusLabels={"dang-ban":"Đang chào bán","da-coc":"Đã cọc","da-ban":"Đã bán"};
let images=[]; let current=0; let all=[]; let currentItem=null;
const FAVORITES_KEY="thanhbinhbds_favorites_v1";

function getFavorites(){try{const v=JSON.parse(localStorage.getItem(FAVORITES_KEY)||"[]");return Array.isArray(v)?v:[]}catch{return[]}}
function isFavorite(id){return getFavorites().includes(id)}
function toggleFavorite(id){const f=getFavorites(),i=f.indexOf(id);if(i>=0)f.splice(i,1);else f.push(id);localStorage.setItem(FAVORITES_KEY,JSON.stringify(f));return f.includes(id)}
function updateSaveButton(){const b=$("#saveProperty");if(!b||!currentItem)return;const saved=isFavorite(currentItem.id);b.classList.toggle("saved",saved);b.innerHTML=`<i class="${saved?"fa-solid":"fa-regular"} fa-heart"></i> ${saved?"Đã lưu":"Lưu tin"}`}
function validPhone(v=""){return /^[0-9+\s().-]{8,20}$/.test(String(v).trim())}

const $=s=>document.querySelector(s);
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function normalizeImageUrl(value=''){let url=String(value||'').trim();if(!url)return'';try{url=decodeURIComponent(url)}catch{}try{const p=new URL(url);if(p.hostname==='github.com'){const a=p.pathname.split('/').filter(Boolean),i=a.indexOf('blob');if(i>=0){return `https://raw.githubusercontent.com/${a[0]}/${a[1]}/${a[i+1]}/${a.slice(i+2).map(encodeURIComponent).join('/')}`}}}catch{}return url}
function slugify(v=''){return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')}
function list(v){const a=String(v||'').split(/\r?\n|•/).map(x=>x.trim()).filter(Boolean);return (a.length?a:['Đang cập nhật']).map(x=>`<li>${esc(x)}</li>`).join('')}
function yt(url=''){const m=String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:shorts\/|watch\?v=|embed\/))([\w-]{6,})/);return m?m[1]:''}
function extractCoordinates(value=''){
  const text=String(value||'').trim();
  if(!text)return null;

  const match=text.match(/(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/);
  if(!match)return null;

  const lat=Number(match[1]);
  const lng=Number(match[2]);

  if(!Number.isFinite(lat)||!Number.isFinite(lng))return null;
  if(lat < -90 || lat > 90 || lng < -180 || lng > 180)return null;

  return {lat,lng,text:`${lat},${lng}`};
}

function mapEmbedUrl(coords,type='roadmap'){
  if(!coords)return '';
  const mapType=type==='satellite'?'k':'m';
  return `https://maps.google.com/maps?q=${coords.lat},${coords.lng}&z=18&t=${mapType}&output=embed`;
}

function directionsUrl(coords){
  if(!coords)return '';
  return `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`;
}

function openLocationUrl(coords){
  if(!coords)return '';
  return `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;
}

let currentCoordinates=null;
let currentMapType='roadmap';

function updateMap(){
  if(!currentCoordinates)return;

  $('#mapFrame').src=mapEmbedUrl(currentCoordinates,currentMapType);
  $('#mapRoadButton').classList.toggle('active',currentMapType==='roadmap');
  $('#mapSatelliteButton').classList.toggle('active',currentMapType==='satellite');
}

function getRequested(){const params=new URLSearchParams(location.search);const id=params.get('id');const parts=location.pathname.split('/').filter(Boolean);return {id,slug:parts[0]==='p'&&parts[1]?decodeURIComponent(parts[1]):params.get('slug')}}
function openLightbox(index=0){current=index;updateLightbox();$('#lightbox').classList.add('open');document.body.classList.add('lightbox-open')}
function updateLightbox(){if(!images.length)return;$('#lightboxImage').src=images[current];$('#lightboxCount').textContent=`${current+1} / ${images.length}`}
function closeLightbox(){$('#lightbox').classList.remove('open');document.body.classList.remove('lightbox-open')}
function renderGallery(){const main=images[0]||'../assets/images/video-poster.jpg';$('#mainPhoto').src=main;const side=$('#gallerySide');side.innerHTML=images.slice(1,3).map((u,i)=>`<button type="button" data-index="${i+1}"><img src="${esc(u)}" alt="Ảnh ${i+2}"></button>`).join('');while(side.children.length<2){side.insertAdjacentHTML('beforeend',`<button type="button" data-index="0"><img src="${esc(main)}" alt="Ảnh bất động sản"></button>`)}$('#mainPhotoButton').onclick=()=>openLightbox(0);side.querySelectorAll('button').forEach(b=>b.onclick=()=>openLightbox(Number(b.dataset.index)));$('#viewAll').onclick=()=>openLightbox(0)}
function renderRelated(item){const related=all.filter(x=>x.id!==item.id&&x.status!=='tam-an').slice(0,3);$('#relatedGrid').innerHTML=related.map(x=>{const slug=x.slug||`${slugify(x.title)}-${x.id}`,img=normalizeImageUrl(x.image)||'../assets/images/video-poster.jpg';return `<a class="related-card" href="../p/${encodeURIComponent(slug)}?id=${x.id}"><img src="${esc(img)}" alt="${esc(x.title)}"><div><h3>${esc(x.title)}</h3><strong>${esc(x.price||'Liên hệ')}</strong></div></a>`}).join('')||'<p>Chưa có sản phẩm liên quan.</p>'}
function render(item){currentItem=item;document.title=`${item.title||'Bất động sản'} | Thanh Bình BĐS`;document.querySelector('meta[name="description"]').content=item.description||`${item.title||'Bất động sản'} tại ${item.location||'Khánh Hòa'}`;$('#breadcrumbs').innerHTML=`<a href="../">Trang chủ</a> / <a href="../#properties">${esc(labels[item.category]||'Bất động sản')}</a> / <span>${esc(item.title||'')}</span>`;$('#categoryBadge').textContent=labels[item.category]||'Bất động sản';$('#statusBadge').textContent=statusLabels[item.status]||'Đang chào bán';$('#title').textContent=item.title||'';$('#location').textContent=item.location||'Khánh Hòa';$('#price').textContent=item.price||'Liên hệ';$('#area').textContent=item.area||'Đang cập nhật';$('#legal').textContent=item.legal||'Đang cập nhật';$('#description').textContent=item.description||'Đang cập nhật';$('#traffic').innerHTML=list(item.traffic);$('#utilities').innerHTML=list(item.utilities);$('#resort').innerHTML=list(item.resort);$('#investment').innerHTML=list(item.investment);
images=(Array.isArray(item.images)?item.images:[]).map(normalizeImageUrl).filter(Boolean);const cover=normalizeImageUrl(item.image);if(cover&&!images.includes(cover))images.unshift(cover);if(!images.length)images=['../assets/images/video-poster.jpg'];renderGallery();
const vid=yt(item.video);if(vid){$('#videoWrap').innerHTML=`<iframe class="youtube-frame" src="https://www.youtube.com/embed/${vid}" title="${esc(item.title)}" allowfullscreen></iframe>`}else{$('#videoSection').hidden=true}
currentCoordinates =
  extractCoordinates(item.coordinates) ||
  extractCoordinates(item.map);

if(currentCoordinates){
  currentMapType='roadmap';
  $('#coordinateText').textContent=`Tọa độ: ${currentCoordinates.text}`;
  $('#mapLink').href=directionsUrl(currentCoordinates);
  $('#mapWrap').innerHTML=`
    <iframe
      id="mapFrame"
      class="map-frame"
      src="${esc(mapEmbedUrl(currentCoordinates,'roadmap'))}"
      loading="lazy"
      referrerpolicy="no-referrer-when-downgrade"
      allowfullscreen
      title="Vị trí bất động sản"
    ></iframe>
    <div class="map-footer">
      <a href="${esc(openLocationUrl(currentCoordinates))}" target="_blank" rel="noopener">
        <i class="fa-solid fa-location-dot"></i>
        Mở vị trí trên Google Maps
      </a>
      <span>${esc(currentCoordinates.text)}</span>
    </div>
  `;
}else{
  $('#mapSection').hidden=true;
}
renderRelated(item);updateSaveButton();$('#loading').hidden=true;$('#page').hidden=false}
async function start(){try{const snap=await getDocs(collection(db,COLLECTION_NAME));all=snap.docs.map(d=>({id:d.id,...d.data()}));const req=getRequested();const item=all.find(x=>req.id?x.id===req.id:(x.slug===req.slug||`${slugify(x.title)}-${x.id}`===req.slug));if(!item||item.status==='tam-an')throw new Error('not-found');render(item)}catch(e){console.error(e);$('#loading').hidden=true;$('#notFound').hidden=false}}
$('#closeLightbox').onclick=closeLightbox;$('#prevPhoto').onclick=()=>{current=(current-1+images.length)%images.length;updateLightbox()};$('#nextPhoto').onclick=()=>{current=(current+1)%images.length;updateLightbox()};$('#lightbox').onclick=e=>{if(e.target.id==='lightbox')closeLightbox()};document.addEventListener('keydown',e=>{if(e.key==='Escape')closeLightbox();if($('#lightbox').classList.contains('open')&&e.key==='ArrowLeft')$('#prevPhoto').click();if($('#lightbox').classList.contains('open')&&e.key==='ArrowRight')$('#nextPhoto').click()});$('#copyLink').onclick=async()=>{await navigator.clipboard.writeText(location.href);$('#copyLink').innerHTML='<i class="fa-solid fa-check"></i> Đã sao chép';setTimeout(()=>$('#copyLink').innerHTML='<i class="fa-regular fa-copy"></i> Sao chép liên kết',1800)};start();

$("#saveProperty").onclick=()=>{
  if(!currentItem)return;
  toggleFavorite(currentItem.id);
  updateSaveButton();
};

$("#shareProperty").onclick=async()=>{
  const shareData={
    title:currentItem?.title||"Thanh Bình BĐS",
    text:`${currentItem?.title||"Bất động sản"} - ${currentItem?.price||"Liên hệ"}`,
    url:location.href
  };

  try{
    if(navigator.share){
      await navigator.share(shareData);
    }else{
      await navigator.clipboard.writeText(location.href);
      $("#shareProperty").innerHTML='<i class="fa-solid fa-check"></i> Đã sao chép link';
      setTimeout(()=>$("#shareProperty").innerHTML='<i class="fa-solid fa-share-nodes"></i> Chia sẻ',1800);
    }
  }catch(error){
    if(error?.name!=="AbortError")console.error(error);
  }
};

$("#leadForm").addEventListener("submit",async(event)=>{
  event.preventDefault();
  const name=$("#leadName").value.trim();
  const phone=$("#leadPhone").value.trim();
  const note=$("#leadNote").value.trim();
  const message=$("#leadMessage");
  const submit=$("#leadSubmit");

  message.textContent="";
  message.className="lead-message";

  if(!validPhone(phone)){
    message.textContent="Vui lòng nhập số điện thoại hợp lệ.";
    message.classList.add("error");
    return;
  }

  if(!currentItem){
    message.textContent="Không tìm thấy thông tin bất động sản.";
    message.classList.add("error");
    return;
  }

  submit.disabled=true;
  submit.textContent="Đang gửi...";

  try{
    await addDoc(collection(db,"leads"),{
      name,
      phone,
      note,
      propertyId:currentItem.id,
      propertyTitle:currentItem.title||"",
      propertyUrl:location.href,
      status:"moi",
      source:"landing-page",
      createdAt:serverTimestamp()
    });

    $("#leadForm").reset();
    message.textContent="Đã gửi yêu cầu. Thanh Bình sẽ liên hệ sớm.";
    message.classList.add("success");
  }catch(error){
    console.error(error);
    message.textContent="Chưa gửi được. Vui lòng gọi hoặc nhắn Zalo.";
    message.classList.add("error");
  }finally{
    submit.disabled=false;
    submit.textContent="Gửi yêu cầu";
  }
});


$("#mapRoadButton")?.addEventListener("click",()=>{
  if(!currentCoordinates)return;
  currentMapType="roadmap";
  updateMap();
});

$("#mapSatelliteButton")?.addEventListener("click",()=>{
  if(!currentCoordinates)return;
  currentMapType="satellite";
  updateMap();
});
