import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const $ = (id) => document.getElementById(id);
const canvas = $('viewport');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setClearColor(0x15191a, 1);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches ? 1.5 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x15191a);
const camera = new THREE.PerspectiveCamera(60, 1, .025, 2500);
const orbit = new OrbitControls(camera, canvas);
orbit.enableDamping = true;
orbit.dampingFactor = .07;
orbit.screenSpacePanning = true;
orbit.minDistance = .3;
orbit.maxPolarAngle = Math.PI - .035;

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const box = new THREE.Box3();
const boxSize = new THREE.Vector3();
const center = new THREE.Vector3();
const meshes = [];
const walkStart = new THREE.Vector3();
const walk = { yaw: 0, pitch: 0, speed: 2.5, eye: 1.65, keys: new Set(), touchMoveX: 0, touchMoveY: 0, active: false };
const up = new THREE.Vector3(0,1,0);
const tmp = new THREE.Vector3();
let loaded = false;
let toastTimer = 0;
let mode = 'overview';
const isTouch = matchMedia('(pointer:coarse)').matches;

function showToast(message) {
  const el = $('toast'); el.textContent = message; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}
function setProgress(value, message) {
  const p = Math.max(0,Math.min(100,Math.round(value)));
  $('progressBar').style.width = `${p}%`;
  $('loadPercent').textContent = `${p}%`;
  if (message) $('loadMessage').textContent = message;
}
function resize() {
  const w = Math.max(canvas.clientWidth, 1), h = Math.max(canvas.clientHeight, 1);
  renderer.setSize(w,h,false);
  camera.aspect = w/h;
  camera.updateProjectionMatrix();
}
function frameModel() {
  box.getCenter(center); box.getSize(boxSize);
  const radius = Math.max(boxSize.length()*.5, .1);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const fit = radius / Math.sin(fov*.5);
  const aspectComp = Math.max(1, 1/Math.max(camera.aspect, .4));
  const distance = fit * 1.24 * aspectComp;
  camera.position.copy(center).addScaledVector(new THREE.Vector3(.88,.44,1).normalize(), distance);
  camera.near = Math.max(.008,radius/5000);
  camera.far = Math.max(500,radius*45);
  camera.updateProjectionMatrix();
  orbit.minDistance = Math.max(.1,radius*.02);
  orbit.maxDistance = Math.max(50,radius*12);
  orbit.target.copy(center);
  orbit.update();
}
// Find a plausible floor point on this scan. No floor-plan/navmesh is assumed.
function findWalkStart() {
  const height = boxSize.y;
  walk.eye = Math.min(1.7, Math.max(.5,height*.19));
  walk.speed = Math.min(4.0,Math.max(.8,boxSize.length()*.115));
  let best = null;
  const offsets = [[0,0],[.12,0],[0,.12],[-.12,0],[0,-.12],[.24,.14],[-.24,-.14],[.28,-.28],[-.28,.28]];
  for (const [fx,fz] of offsets) {
    const x=center.x + fx*boxSize.x, z=center.z+fz*boxSize.z;
    raycaster.set(tmp.set(x, box.max.y + Math.max(1,height), z), new THREE.Vector3(0,-1,0));
    raycaster.far = Math.max(100,height*4);
    const hits=raycaster.intersectObjects(meshes,false);
    const floor=hits.filter(hit => {
      const norm=hit.face?.normal;
      return norm && Math.abs(norm.y)>.58 && hit.point.y < box.min.y+height*.60;
    });
    const hit=floor.sort((a,b)=>a.point.y-b.point.y)[0];
    if (hit && (!best || Math.abs(hit.point.y - (box.min.y+height*.12))<best.score)) {
      best={ point:hit.point.clone(), score:Math.abs(hit.point.y-(box.min.y+height*.12)) };
    }
  }
  if(best) walkStart.set(best.point.x, best.point.y+walk.eye, best.point.z);
  else walkStart.set(center.x,box.min.y+height*.24+walk.eye,center.z);
  walkStart.y=Math.max(box.min.y+walk.eye*.5, Math.min(box.max.y-walk.eye*.4, walkStart.y));
}
function changeMode(next, atPoint=null) {
  if (!loaded || !['overview','walk'].includes(next)) return;
  if (next === 'overview') {
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    if (mode === 'walk') {
      // Keep the overview pointed toward the current position, so switching is spatially coherent.
      orbit.target.copy(camera.position);
      const radius=Math.max(boxSize.length()*.5,1);
      camera.position.add(new THREE.Vector3(radius*.4,radius*.28,radius*.48));
      orbit.update();
    }
    mode='overview'; orbit.enabled=true;
    $('intro').classList.remove('is-hidden');
    $('lookTip').hidden=true; $('walkReticle').hidden=true;
    $('mobilePad').hidden=true; $('mobileLookLabel').hidden=true;
    $('modeHint').innerHTML='DRAG TO ROTATE <span>·</span> SCROLL TO ZOOM';
    canvas.classList.remove('walking');
  } else {
    if (mode !== 'walk') {
      if (atPoint) walkStart.copy(atPoint);
      camera.position.copy(walkStart);
      const target = center.clone();
      walk.yaw=Math.atan2(camera.position.x-target.x, camera.position.z-target.z);
      walk.pitch=0;
    }
    mode='walk'; orbit.enabled=false;
    updateWalkRotation();
    $('intro').classList.add('is-hidden');
    $('walkReticle').hidden=false;
    $('lookTip').hidden=isTouch || Boolean(document.pointerLockElement);
    $('mobilePad').hidden=!isTouch; $('mobileLookLabel').hidden=!isTouch;
    $('modeHint').innerHTML='W A S D TO MOVE <span>·</span> MOUSE TO LOOK';
    canvas.classList.add('walking');
  }
  $('overviewBtn').classList.toggle('active',mode==='overview');
  $('walkBtn').classList.toggle('active',mode==='walk');
  $('overviewBtn').setAttribute('aria-pressed',String(mode==='overview'));
  $('walkBtn').setAttribute('aria-pressed',String(mode==='walk'));
  walk.keys.clear();walk.touchMoveX=0;walk.touchMoveY=0;
}
function updateWalkRotation() {
  camera.rotation.order='YXZ';
  camera.rotation.set(walk.pitch, walk.yaw, 0, 'YXZ');
}
function resetView() {
  if (!loaded) return;
  if(mode==='walk') { camera.position.copy(walkStart);walk.yaw=0;walk.pitch=0;updateWalkRotation(); }
  else { frameModel(); }
  showToast('View reset');
}

$('overviewBtn').addEventListener('click',()=>changeMode('overview'));
$('walkBtn').addEventListener('click',()=>changeMode('walk'));
$('resetBtn').addEventListener('click',resetView);
$('shareBtn').addEventListener('click',async()=>{
  if(navigator.share && isTouch) {
    try{await navigator.share({title:'Interactive 3D Walkthrough',url:location.href});return;}catch(e){if(e.name==='AbortError')return;}
  }
  try { await navigator.clipboard.writeText(location.href); showToast('Link copied'); }
  catch(e){showToast('Copy the address from your browser');}
});
function openHelp(){if(document.pointerLockElement===canvas)document.exitPointerLock();$('helpDialog').hidden=false;}
function closeHelp(){$('helpDialog').hidden=true;}
$('helpBtn').addEventListener('click',openHelp);
$('closeHelp').addEventListener('click',closeHelp);
$('doneHelp').addEventListener('click',closeHelp);
$('helpDialog').addEventListener('pointerdown',e=>{if(e.target===$('helpDialog'))closeHelp();});
window.addEventListener('keydown',e=>{
  if(e.code==='Escape' && !$('helpDialog').hidden)closeHelp();
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code) && mode==='walk')e.preventDefault();
  walk.keys.add(e.code);
});
window.addEventListener('keyup',e=>walk.keys.delete(e.code));
window.addEventListener('blur',()=>walk.keys.clear());
canvas.addEventListener('click',e=>{
  if(mode==='walk' && !isTouch && document.pointerLockElement!==canvas){
    canvas.requestPointerLock?.();
  }
});
document.addEventListener('pointerlockchange',()=>{
  $('lookTip').hidden=mode!=='walk'||isTouch||document.pointerLockElement===canvas;
});
document.addEventListener('mousemove',e=>{
  if(mode!=='walk'||document.pointerLockElement!==canvas||!$('helpDialog').hidden)return;
  walk.yaw-=e.movementX*.0023;
  walk.pitch=THREE.MathUtils.clamp(walk.pitch-e.movementY*.0023,-1.5,1.5);
  updateWalkRotation();
});
let lookTouchId=null,lookLastX=0,lookLastY=0;
canvas.addEventListener('pointerdown',e=>{
  if(mode!=='walk'||e.pointerType!=='touch'||!$('helpDialog').hidden)return;
  if(lookTouchId!==null)return;
  lookTouchId=e.pointerId;lookLastX=e.clientX;lookLastY=e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{
  if(e.pointerId!==lookTouchId||mode!=='walk')return;
  walk.yaw-=(e.clientX-lookLastX)*.005;
  walk.pitch=THREE.MathUtils.clamp(walk.pitch-(e.clientY-lookLastY)*.005,-1.5,1.5);
  lookLastX=e.clientX;lookLastY=e.clientY;updateWalkRotation();
});
function releaseTouch(e){if(e.pointerId===lookTouchId)lookTouchId=null;}
canvas.addEventListener('pointerup',releaseTouch);canvas.addEventListener('pointercancel',releaseTouch);

const joystick=$('joystick'),stick=$('stick');let joyId=null;
function joyMove(e){
  const r=joystick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
  let dx=e.clientX-cx,dy=e.clientY-cy;
  const max=r.width*.32,len=Math.hypot(dx,dy);
  if(len>max){dx=dx/len*max;dy=dy/len*max;}
  walk.touchMoveX=dx/max;walk.touchMoveY=-dy/max;
  stick.style.transform=`translate(${dx}px, ${dy}px)`;
}
joystick.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();joyId=e.pointerId;joystick.setPointerCapture(joyId);joyMove(e);});
joystick.addEventListener('pointermove',e=>{if(joyId===e.pointerId){e.preventDefault();joyMove(e);}});
function joyStop(e){if(joyId!==e.pointerId)return;joyId=null;walk.touchMoveX=walk.touchMoveY=0;stick.style.transform='translate(0,0)';}
joystick.addEventListener('pointerup',joyStop);joystick.addEventListener('pointercancel',joyStop);

// Double-click on a horizontal part of the model to choose an entry point.
const pointer2=new THREE.Vector2();
canvas.addEventListener('dblclick',e=>{
  if(mode!=='overview'||!loaded)return;
  const rect=canvas.getBoundingClientRect();
  pointer2.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
  raycaster.setFromCamera(pointer2,camera);raycaster.far=camera.far;
  const hits=raycaster.intersectObjects(meshes,false);
  const hit=hits.find(h=>h.face && Math.abs(h.face.normal.y)>.5);
  if(!hit){showToast('Double-click a floor surface to enter');return;}
  const at=hit.point.clone().addScaledVector(up,walk.eye);
  changeMode('walk',at);
  showToast('Walk from selected point');
});

function animate() {
  const dt=Math.min(clock.getDelta(),.05);
  if(mode==='overview') orbit.update();
  if(mode==='walk' && $('helpDialog').hidden) {
    const keys=walk.keys;
    let x=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+walk.touchMoveX;
    let z=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)+walk.touchMoveY;
    let y=(keys.has('KeyE')||keys.has('Space')?1:0)-(keys.has('KeyQ')?1:0);
    const norm=Math.max(1,Math.hypot(x,z,y));x/=norm;z/=norm;y/=norm;
    const step=dt*walk.speed*(keys.has('ShiftLeft')||keys.has('ShiftRight')?2.25:1);
    camera.position.x += (-Math.sin(walk.yaw)*z+Math.cos(walk.yaw)*x)*step;
    camera.position.z += (-Math.cos(walk.yaw)*z-Math.sin(walk.yaw)*x)*step;
    camera.position.y += y*step;
    // Avoid accidentally navigating thousands of units away from the scanned scene.
    camera.position.clamp(box.min.clone().addScalar(-boxSize.length()*.3),box.max.clone().addScalar(boxSize.length()*.3));
  }
  renderer.render(scene,camera);
}

resize();window.addEventListener('resize',resize);
renderer.setAnimationLoop(animate);
const loader=new GLTFLoader();
loader.load('./assets/space.glb',gltf=>{
  scene.add(gltf.scene);
  gltf.scene.traverse(o=>{
    if(!o.isMesh)return;
    meshes.push(o);
    // Photo-textured photogrammetry is already baked; unlit, double-sided materials
    // preserve the real scan's texture on both exterior and interior surfaces.
    const old=Array.isArray(o.material)?o.material:[o.material];
    const baked=old.map(m=>new THREE.MeshBasicMaterial({
      map:m.map||null,color:m.color||0xffffff,side:THREE.DoubleSide,
      transparent:m.transparent,opacity:m.opacity,alphaTest:m.alphaTest||0
    }));
    o.material=Array.isArray(o.material)?baked:baked[0];
  });
  box.setFromObject(gltf.scene);
  if(box.isEmpty())throw new Error('Scan loaded but contains no visible geometry.');
  frameModel();
  findWalkStart();
  loaded=true;
  setProgress(100,'ENVIRONMENT READY');
  $('scanState').innerHTML='<span class="state-dot"></span> SCAN READY';
  setTimeout(()=>$('loading').classList.add('complete'),400);
},xhr=>{
  if(xhr.total) setProgress(Math.min(95,100*xhr.loaded/xhr.total),'STREAMING 3D GEOMETRY');
  else $('loadMessage').textContent=`DOWNLOADED ${(xhr.loaded/1048576).toFixed(1)} MB`;
},err=>{
  console.error('Could not load GLB:',err);
  $('loadMessage').textContent='LOAD FAILED';
  $('loadError').hidden=false;
  $('loadError').textContent='The scan could not be opened. Make sure assets/space.glb is uploaded alongside index.html, and that you are using a web server (not opening index.html directly from your files).';
});
