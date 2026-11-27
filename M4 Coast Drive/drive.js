/* Classic scripts and an embedded GLB keep this game playable directly from file://. */
(async function startGame(){
  'use strict';
  const $=id=>document.getElementById(id),T=window.THREE;
  try {
    const renderer=new T.WebGLRenderer({canvas:$('view'),antialias:true,powerPreference:'high-performance'});
    renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
    const scene=new T.Scene(),camera=new T.PerspectiveCamera(54,1,.11,2800),clamp=T.MathUtils.clamp,mix=T.MathUtils.lerp;
    scene.fog=new T.FogExp2(0xc9afba,.00165);
    const art=await loadCoastalLight(renderer,scene);
    const light=new T.DirectionalLight(0xffc391,2.25);light.position.copy(art.sun).multiplyScalar(100);scene.add(light,new T.HemisphereLight(0xd2d7f6,0xae8b87,1.28));
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
    light.castShadow=true;light.shadow.mapSize.set(1024,1024);scene.add(light.target);
    Object.assign(light.shadow.camera,{left:-51,right:51,top:51,bottom:-51,near:1,far:185});light.shadow.camera.updateProjectionMatrix();light.shadow.normalBias=.07;light.shadow.bias=-.00023;
    let shadowX=Infinity,shadowZ=Infinity;
    const world=buildCoast(scene,art);
    for(let band=0;band<2;band++){
      const p=[],ind=[],r=1110+310*band;
      for(let i=0;i<=160;i++){
        const a=i/160*Math.PI*2,h=18+band*20+26*Math.sin(a*4.3+.3*band)**2+23*Math.sin(a*9.8)**2+8*Math.sin(a*30);
        p.push(Math.sin(a)*r,-8,Math.cos(a)*r,Math.sin(a)*r,h*.30,Math.cos(a)*r);if(i){const k=i*2;ind.push(k-2,k-1,k,k,k-1,k+1);}}
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(ind);
      scene.add(new T.Mesh(g,new T.MeshBasicMaterial({color:band?0xba9eac:0xa193a2,side:T.DoubleSide,fog:false})));
    }
    const raw=Uint8Array.from(atob(window.M4_GLB_GZIP),s=>s.charCodeAt(0));delete window.M4_GLB_GZIP;
    const buffer=await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    const gltf=await new GLTFLoader().parseAsync(buffer,'');
    const vehicle=new T.Group(),model=gltf.scene;model.rotation.y=-Math.PI/2;vehicle.rotation.order='YXZ';vehicle.add(model);scene.add(vehicle);
    const wheels=[],tail=[];
    for(const key of ['FL','FR','RL','RR']){
      const rim=model.getObjectByName('Wheel'+key),caliper=model.getObjectByName('Caliper'+key),pivot=new T.Group();
      pivot.position.copy(rim.position);model.add(pivot);pivot.add(rim,caliper);rim.position.set(0,0,0);caliper.position.set(0,0,0);wheels.push({rim,pivot,front:key[0]==='F'});
    }
    model.traverse(o=>{if(!o.isMesh)return;const m=o.material;o.receiveShadow=true;
      if(m.name.includes('Solar glazing')){m.depthWrite=false;m.side=T.FrontSide;m.opacity=.83;m.metalness=.37;m.roughness=.095;}
      if(m.name.includes('Isle of Man Green')){const paint=new T.MeshPhysicalMaterial();T.MeshStandardMaterial.prototype.copy.call(paint,m);paint.clearcoat=1;paint.clearcoatRoughness=.105;paint.roughness=.25;paint.color.multiplyScalar(1.18);o.material=paint;}
      if(m.name.includes('Tail lamp  /  light guide')&&!tail.includes(m))tail.push(m);
    });
    const contact=document.createElement('canvas');contact.width=contact.height=128;const sc=contact.getContext('2d'),sg=sc.createRadialGradient(64,64,15,64,64,64);
    sg.addColorStop(0,'rgba(13,21,20,.79)');sg.addColorStop(.67,'rgba(13,21,20,.48)');sg.addColorStop(1,'rgba(13,21,20,0)');sc.fillStyle=sg;sc.fillRect(0,0,128,128);
    const shadow=new T.Mesh(new T.PlaneGeometry(3.0,5.9),new T.MeshBasicMaterial({map:new T.CanvasTexture(contact),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.017;vehicle.add(shadow);
    const state={x:0,z:0,h:0,v:0,vx:0,vz:0,steer:0,roll:0,spin:0,trip:0,onRoad:true,road:null,rev:0,rpm:900,gear:'N',cam:0};
    const keys=new Set(),gate=new T.Group(),centers=[-4.7,4.7];scene.add(gate);
    const gateMat=new T.MeshBasicMaterial({color:0xffac72});for(const x of centers){
      const post=new T.Mesh(new T.CylinderGeometry(.11,.17,3.5,9),gateMat);post.position.set(x,1.75,0);gate.add(post);
      const flag=new T.Mesh(new T.BoxGeometry(1.13,.58,.13),gateMat);flag.position.set(x-Math.sign(x)*.50,3.23,0);gate.add(flag);
    }
    const stripe=new T.Mesh(new T.BoxGeometry(9.4,.055,.38),gateMat);stripe.position.y=.08;gate.add(stripe);gate.visible=false;
    let mode='loading',cameraSnap=true,clock=0,noticeTime=0,trial=null,trialIndex=0,trialTime=0,timing=false;
    let audioContext,osc1,osc2,filter,gain,sound=true;let lastFrame=performance.now(),accum=0,hudClock=1;
    const pathFor=ids=>{const pts=[];for(let id of ids){const rev=id.startsWith('-');if(rev)id=id.slice(1);let part=world.roads.find(r=>r.id===id).pts;if(rev)part=part.slice().reverse();pts.push(...(pts.length?part.slice(1):part));}return pts;};
    const routes=[{id:'faro',name:'Faro Sprint',desc:'Harbour to north cape',ids:['palm','light','north']},
      {id:'serra',name:'Serra Circuit',desc:'A full mountain loop',ids:['fields','pass','mills','south','-farm','-market']}];
    for(const r of routes){r.line=pathFor(r.ids);r.distance=0;r.gates=[];let next=0;
      r.line.forEach((p,i)=>{if(i)r.distance+=Math.hypot(p.x-r.line[i-1].x,p.z-r.line[i-1].z);
        if(r.distance>=next||i===r.line.length-1){if(i===r.line.length-1&&r.gates.length>1&&r.distance-next+85<29)r.gates.pop();r.gates.push({p,i});next=r.distance+85;}});}
    function best(r){try{const n=Number(localStorage.getItem('pelago-1-'+r.id));return n>0?n:null;}catch{return null;}}
    function format(t){return `${Math.floor(t/60)}:${(t%60).toFixed(1).padStart(4,'0')}`;}
    function toast(text){$('toast').textContent=text;$('toast').classList.add('show');noticeTime=2.7;}
    function setMode(value){mode=value;document.body.dataset.mode=value;keys.clear();accum=0;lastFrame=performance.now();
      if(value==='atlas'){routeMenu();paintMap(true);}if(value==='drive')cameraSnap=true;
      if(gain&&value!=='drive')gain.gain.setTargetAtTime(0,audioContext.currentTime,.04);
    }
    function initAudio(){if(audioContext||!sound)return;try{
      audioContext=new AudioContext();osc1=audioContext.createOscillator();osc2=audioContext.createOscillator();filter=audioContext.createBiquadFilter();gain=audioContext.createGain();
      osc1.type='sawtooth';osc2.type='triangle';filter.type='lowpass';filter.Q.value=.7;gain.gain.value=0;
      osc1.connect(filter);osc2.connect(filter);filter.connect(gain);gain.connect(audioContext.destination);osc1.start();osc2.start();
    }catch{sound=false;}}
    function audio(){if(!gain)return;const t=audioContext.currentTime,throttle=pressed('KeyW','ArrowUp');osc1.frequency.setTargetAtTime(state.rpm/28,t,.07);osc2.frequency.setTargetAtTime(state.rpm/56,t,.07);filter.frequency.setTargetAtTime(190+state.rpm*(throttle?.22:.10),t,.09);gain.gain.setTargetAtTime(sound&&mode==='drive'?(throttle?.044:.025):0,t,.07);}
    function toggleAudio(){sound=!sound;if(sound){initAudio();audioContext?.resume();}$('audio').innerHTML=`Sound <b>${sound?'on':'off'}</b>`;audio();}
    const pressed=(...codes)=>codes.some(c=>keys.has(c));
    function cancelTrial(){trial=null;trialIndex=0;trialTime=0;timing=false;gate.visible=false;}
    function putGate(){if(!trial)return;const {p,i}=trial.gates[trialIndex],n=trial.line[Math.min(i+1,trial.line.length-1)],b=trial.line[Math.max(0,i-1)];
      gate.position.set(p.x,world.ground(p.x,p.z)+world.roadLift+.04,p.z);gate.rotation.y=-Math.atan2(n.x-b.x,b.z-n.z);gate.visible=true;}
    function selectRoute(r){cancelTrial();trial=r;putGate();setMode('drive');toast('Drive to the orange start gate');hudClock=1;}
    function routeMenu(){const list=$('routeList');list.replaceChildren();for(const r of routes){const button=document.createElement('button');button.className='route';const record=best(r);
      button.innerHTML=`<strong>${r.name} ↗</strong><small>${(r.distance/1000).toFixed(1)} KM · ${r.desc}</small><small>BEST ${record?format(record):'—'}</small>`;button.onclick=()=>selectRoute(r);list.append(button);}}
    function raceStep(dt){if(!trial)return;if(timing)trialTime+=dt;
      if(Math.hypot(state.x-gate.position.x,state.z-gate.position.z)>5.45)return;
      if(!timing){timing=true;trialTime=0;toast('Timer started · '+trial.name);}
      if(++trialIndex===trial.gates.length){const old=best(trial),record=old===null||trialTime<old;if(record)try{localStorage.setItem('pelago-1-'+trial.id,String(trialTime));}catch{}
        toast(`${trial.name} · ${format(trialTime)}${record?' · Personal best!':''}`);cancelTrial();
      }else putGate();hudClock=1;
    }
    function place(p,heading){state.h=heading;state.x=p.x+Math.cos(heading)*2;state.z=p.z+Math.sin(heading)*2;state.v=state.vx=state.vz=state.steer=state.roll=state.rev=0;
      state.onRoad=true;state.road=world.nearest(state.x,state.z);cameraSnap=true;hudClock=1;syncCar();}
    function recover(){let n=world.nearest(state.x,state.z,true),h=n.heading;if(Math.cos(h-state.h)<0)h+=Math.PI;
      if(timing){trialIndex=0;trialTime=0;timing=false;putGate();toast('Recovered · time trial reset');}else toast('Back on the road');place(n,h);}
    function changeCamera(){state.cam=(state.cam+1)%3;cameraSnap=true;toast(['Chase camera','Bonnet camera','Front tracking camera'][state.cam]);}
    function physics(dt){
      const s=state,road=world.nearest(s.x,s.z),onRoad=!!road&&road.d<road.segment.width/2+.45;s.road=road;s.onRoad=onRoad;
      const throttle=pressed('KeyW','ArrowUp'),brake=pressed('KeyS','ArrowDown'),slide=keys.has('Space'),turn=Number(pressed('KeyD','ArrowRight'))-Number(pressed('KeyA','ArrowLeft'));
      const absv=Math.abs(s.v),grip=onRoad?1:.63;
      s.steer=mix(s.steer,turn,1-Math.exp(-dt*(turn?5.3:8)));
      if(brake&&s.v<.12&&!throttle)s.rev+=dt;else s.rev=0;
      let accel=0;
      if(throttle)accel=s.v<-.15?13:(9.0*grip/(1+absv*.028));
      if(brake)accel=s.v>.15?-16*grip:s.rev>.28?-4.2*grip:0;
      const loss=(onRoad?.35:1.95)+absv*(onRoad?.012:.065)+s.v*s.v*(onRoad?.00108:.0045)+(slide?7.3:0);
      const driven=s.v+accel*dt;s.v=Math.sign(driven)*Math.max(0,Math.abs(driven)-loss*dt);
      if(brake&&s.v>=0&&s.v<.16)s.v=0;s.v=clamp(s.v,-9.1,63);
      if(Math.abs(s.v)<.025&&!throttle&&!brake)s.v=0;
      const steerAngle=s.steer*(.53/(1+absv*.051))*(slide?1.36:1),yaw=s.v/2.86*Math.tan(steerAngle);
      s.h+=yaw*dt;const fX=Math.sin(s.h),fZ=-Math.cos(s.h),follow=1-Math.exp(-dt*(slide?2.1:9.6)*grip);
      s.vx=mix(s.vx,fX*s.v,follow);s.vz=mix(s.vz,fZ*s.v,follow);
      const dx=s.vx*dt,dz=s.vz*dt,x=s.x+dx,z=s.z+dz;
      if(world.shore(x,z)<2.2){recover();toast('Coastline reached · returned to road');return;}
      const collision=[-1.40,0,1.40].some(d=>world.blocked(x+fX*d,z+fZ*d));
      if(collision){s.vx=s.vz=0;s.v=0;s.x-=Math.sign(dx)*Math.min(.10,Math.abs(dx));s.z-=Math.sign(dz)*Math.min(.10,Math.abs(dz));}
      else{s.x=x;s.z=z;s.trip+=Math.hypot(dx,dz);}
      s.spin=(s.spin+s.v*dt/.347)%(Math.PI*2);s.roll=mix(s.roll,clamp(-yaw*s.v*.0035,-.066,.066),dt*5);
      const gear=absv<.22?'N':s.v<0?'R':Math.min(7,1+Math.floor(absv/8.8));s.gear=gear;
      s.rpm=gear==='N'?950:gear==='R'?1100+absv*210:Math.min(7200,1250+absv*(gear===1?450:480/(gear*.69)));
      raceStep(dt);
    }
    function syncCar(){const s=state,fx=Math.sin(s.h),fz=-Math.cos(s.h),rx=-fz,rz=fx;
      const height=world.ground(s.x,s.z)+(s.onRoad?world.roadLift+.019:.03);vehicle.position.set(s.x,height,s.z);
      const slope=(world.ground(s.x+fx*1.43,s.z+fz*1.43)-world.ground(s.x-fx*1.43,s.z-fz*1.43))/2.86;
      const camber=(world.ground(s.x+rx*.83,s.z+rz*.83)-world.ground(s.x-rx*.83,s.z-rz*.83))/1.66;
      vehicle.rotation.set(Math.atan(slope),-s.h,Math.atan(camber)+s.roll,'YXZ');
      for(const w of wheels){w.pivot.rotation.y=w.front?-s.steer*.44/(1+Math.abs(s.v)*.05):0;w.rim.rotation.z=s.spin;}
      for(const m of tail)m.emissiveIntensity=pressed('KeyS','ArrowDown','Space')?3.8:1.05;
      // Static scenery shadows only need refreshing when the car leaves the current patch.
      if(Math.hypot(s.x-shadowX,s.z-shadowZ)>12){shadowX=s.x;shadowZ=s.z;light.target.position.set(s.x,height,s.z);light.position.copy(light.target.position).addScaledVector(art.sun,100);renderer.shadowMap.needsUpdate=true;}
    }
    const target=new T.Vector3(),wanted=new T.Vector3(),look=new T.Vector3(),right=new T.Vector3(),up=new T.Vector3(0,1,0);
    function cameraStep(dt){const s=state,fx=Math.sin(s.h),fz=-Math.cos(s.h),rx=-fz,rz=fx,y=vehicle.position.y,portrait=innerWidth/innerHeight<.87;
      let fov=53;
      if(mode==='intro'||mode==='loading'){
        const a=.64+Math.sin(clock*.085)*.09,d=portrait?Math.max(8.4,5.4/camera.aspect):Math.max(8.15,11.8/camera.aspect);
        wanted.set(s.x+d*(-fx*Math.cos(a)-rx*Math.sin(a)),y+1.43,s.z+d*(-fz*Math.cos(a)-rz*Math.sin(a)));
        target.set(s.x,y+(portrait?.33:.82),s.z);right.copy(target).sub(wanted).cross(up).normalize();target.addScaledVector(right,portrait?0:-1.52);fov=portrait?55:38;
      }else if(s.cam===1){wanted.set(s.x+fx*.80,y+1.09,s.z+fz*.80);target.set(s.x+fx*20,y+.94+Math.sin(vehicle.rotation.x)*20,s.z+fz*20);fov=68;
      }else{
        const front=s.cam===2,dist=front?6.75:7.1+Math.abs(s.v)*.049,offset=front?2.15:.15;
        wanted.set(s.x+fx*dist*(front?1:-1)+rx*offset,y+(front?1.67:2.50)+Math.abs(s.v)*.008,s.z+fz*dist*(front?1:-1)+rz*offset);
        const ahead=front?0:3.48;target.set(s.x+fx*ahead,y+(front?.76:1.00),s.z+fz*ahead);fov=front?48:52+Math.abs(s.v)*.12;
      }
      wanted.y=Math.max(wanted.y,world.ground(wanted.x,wanted.z)+.48);
      if(cameraSnap||s.cam===1){camera.position.copy(wanted);look.copy(target);}else{camera.position.lerp(wanted,1-Math.exp(-dt*7));look.lerp(target,1-Math.exp(-dt*11));}
      cameraSnap=false;camera.lookAt(look);if(Math.abs(camera.fov-fov)>.02){camera.fov=fov;camera.updateProjectionMatrix();}
    }

    const atlasBase=document.createElement('canvas');atlasBase.width=atlasBase.height=1220;
    const atlasOrigin={x:-485,z:-605},atlasSize=1220,bx=atlasBase.getContext('2d');
    bx.fillStyle='#284346';bx.fillRect(0,0,atlasSize,atlasSize);bx.save();bx.translate(-atlasOrigin.x,-atlasOrigin.z);
    const terrainPalette=['#3d5147','#435448','#47574a','#495a4d','#50604f','#526351'];
    for(let z=atlasOrigin.z;z<atlasOrigin.z+atlasSize;z+=6)for(let x=atlasOrigin.x;x<atlasOrigin.x+atlasSize;x+=6){
      const d=world.shore(x,z);if(d<0)continue;bx.fillStyle=d<11?'#79806a':terrainPalette[clamp(Math.floor(world.ground(x,z)/12),0,5)];bx.fillRect(x,z,6.2,6.2);}
    function trace(ctx,points){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.z):ctx.moveTo(p.x,p.z));ctx.stroke();}
    bx.lineCap='round';bx.lineJoin='round';bx.strokeStyle='#263b35';bx.lineWidth=7;world.roads.forEach(r=>trace(bx,r.pts));
    bx.strokeStyle='#aeb7a1';bx.lineWidth=2.8;world.roads.forEach(r=>trace(bx,r.pts));
    bx.lineWidth=.7;bx.strokeStyle='#d5dfca20';for(let p=-600;p<800;p+=100){bx.beginPath();bx.moveTo(p,-700);bx.lineTo(p,700);bx.moveTo(-600,p);bx.lineTo(800,p);bx.stroke();}bx.restore();
    function paintMap(full){const cv=full?$('map'):$('mini'),c=cv.getContext('2d'),w=cv.width,h=cv.height;
      const scale=full?Math.min(w/1020,h/1170):1.92,cx=full?58:state.x,cz=full?-22:state.z;
      const anchorY=full?h*.50:h*.64;c.fillStyle='#284346';c.fillRect(0,0,w,h);c.save();c.translate(w/2,anchorY);if(!full)c.rotate(-state.h);
      c.scale(scale,scale);c.translate(-cx,-cz);c.drawImage(atlasBase,atlasOrigin.x,atlasOrigin.z);
      if(trial){c.strokeStyle='#ffb478';c.lineWidth=full?4.6:2.9;trace(c,trial.line);const p=trial.gates[trialIndex].p;
        c.beginPath();c.arc(p.x,p.z,full?8:4,0,Math.PI*2);c.fillStyle='#ffb478';c.fill();}
      if(full){c.textAlign='center';c.font='bold 17px Consolas,monospace';
        for(const [label,x,z] of [['FARO',-300,-313],['PORTO VECCHIO',-91,82],['SERRA ALTA',344,-308],['MARINA',42,453]]){
          c.lineWidth=4;c.strokeStyle='#3c5148';c.strokeText(label,x,z);c.fillStyle='#f0e8ce';c.fillText(label,x,z);}}
      c.translate(state.x,state.z);c.rotate(state.h);const size=full?15:6.2;
      c.beginPath();c.moveTo(0,-size);c.lineTo(size*.70,size*.74);c.lineTo(0,size*.39);c.lineTo(-size*.70,size*.74);c.closePath();c.strokeStyle='#1a3533';c.lineWidth=size*.28;c.stroke();c.fillStyle='#bcf8ce';c.fill();c.restore();
      if(full){c.fillStyle='#daead8';c.font='bold 17px Consolas,monospace';c.fillText('N ↑',18,28);c.font='14px Consolas,monospace';c.fillText('PELAGO  /  PC–01',18,h-20);}
    }
    function hud(){const s=state;$('speed').textContent=String(Math.round(Math.abs(s.v)*3.6)).padStart(3,'0');$('gear').textContent=s.gear;
      $('rpm').style.width=clamp(s.rpm/7200*100,10,100)+'%';$('trip').textContent=(s.trip/1000).toFixed(1)+' KM';$('surface').textContent=s.onRoad?'ASPHALT':'OFF ROAD';
      $('street').textContent=trial?trial.name:(s.onRoad?s.road?.segment.label:'Open country');$('activity').textContent=trial?(timing?'TIME TRIAL':'ROUTE SELECTED'):'FREE ROAM';
      $('objective').textContent=trial?(timing?`${format(trialTime)}  ·  GATE ${trialIndex+1}/${trial.gates.length}`:`START GATE  ·  ${Math.round(Math.hypot(s.x-gate.position.x,s.z-gate.position.z))} M`):'PELAGO COAST';paintMap(false);audio();}
    function begin(){initAudio();audioContext?.resume();setMode('drive');hud();}
    $('start').onclick=begin;$('resume').onclick=begin;$('pause').onclick=()=>setMode('pause');
    $('mini-button').onclick=$('pauseMap').onclick=()=>setMode('atlas');$('closeMap').onclick=begin;
    $('free').onclick=()=>{cancelTrial();begin();toast('Free roam');};$('audio').onclick=toggleAudio;
    $('recover').onclick=()=>{recover();begin();};$('cameraBtn').onclick=()=>{changeCamera();begin();};
    const drivingKeys=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyS','KeyA','KeyD','Space'];
    window.addEventListener('keydown',e=>{
      if(mode==='drive'&&drivingKeys.includes(e.code)){e.preventDefault();keys.add(e.code);return;}
      if(e.repeat)return;
      if(e.code==='Escape'){if(mode==='drive')setMode('pause');else if(mode==='pause'||mode==='atlas')begin();}
      if(e.code==='KeyM'){if(mode==='drive'||mode==='pause')setMode('atlas');else if(mode==='atlas')begin();}
      if(mode==='drive'){if(e.code==='KeyR')recover();if(e.code==='KeyC')changeCamera();if(e.code==='KeyV')toggleAudio();}
    });window.addEventListener('keyup',e=>keys.delete(e.code));
    const suspend=()=>{keys.clear();if(mode==='drive')setMode('pause');};window.addEventListener('blur',suspend);document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();});
    for(const button of document.querySelectorAll('[data-key]')){
      button.onpointerdown=e=>{e.preventDefault();button.setPointerCapture(e.pointerId);keys.add(button.dataset.key);};
      button.onlostpointercapture=button.onpointerup=button.onpointercancel=()=>keys.delete(button.dataset.key);
    }
    let cinematic=true,lastReflection=-Infinity;
    try{cinematic=localStorage.getItem('pelago-graphics')!=='performance';}catch{}
    const quality=$('graphics');
    function resize(){const maxPixels=cinematic?1850000:850000;const dpr=Math.min(window.devicePixelRatio||1,1.65,Math.sqrt(maxPixels/(innerWidth*innerHeight)));renderer.setPixelRatio(dpr);renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();cameraSnap=true;lastReflection=-Infinity;quality.textContent='Graphics: '+(cinematic?'Cinematic':'Performance');}
    quality.onclick=()=>{cinematic=!cinematic;try{localStorage.setItem('pelago-graphics',cinematic?'cinematic':'performance');}catch{}art.reflectionAmount.value=0;resize();};
    window.addEventListener('resize',resize);resize();
    // Start just south of the sprint gate, facing the lighthouse along the coast.
    const approach=world.roads.find(r=>r.id==='prom').pts,p=approach[approach.length-8];place(p,Math.atan2(p.rz,p.rx));
    art.carReflection(vehicle);vehicle.rotation.y+=Math.PI;setMode('intro');$('start').disabled=false;$('start').textContent='Start driving   →';
    function frame(now){requestAnimationFrame(frame);const dt=Math.min(.12,Math.max(0,(now-lastFrame)/1000));lastFrame=now;
      if(mode==='atlas'||mode==='pause')return;clock+=dt;
      if(mode==='drive'){accum+=dt;while(accum>=1/90){physics(1/90);accum-=1/90;}syncCar();hudClock+=dt;if(hudClock>.085){hud();hudClock=0;}}
      if(noticeTime>0){noticeTime-=dt;if(noticeTime<=0)$('toast').classList.remove('show');}
      world.water.material.uniforms.clock.value=clock;for(const t of world.turbines)t.rotation.z=clock*.31;
      const cut=cameraSnap;cameraStep(dt);
      if(cinematic&&mode==='drive'&&Math.abs(state.v)<10)art.carReflection(vehicle);
      if(cinematic&&(cut||now-lastReflection>115)){art.reflect(camera,world,vehicle);lastReflection=now;}
      renderer.render(scene,camera);
    }
    requestAnimationFrame(frame);
  } catch(error){console.error(error);const btn=$('start');btn.textContent='Unable to start';const msg=document.querySelector('.hero p');msg.textContent='The game could not load. Open this folder’s index.html in a current Chrome, Edge, or Firefox browser with WebGL 2 enabled. '+error.message;}
})();
