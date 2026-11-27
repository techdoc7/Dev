/* Pelago Coast — the terrain, road graph and scenery share one metre-based coordinate system. */
function buildCoast(scene,art) {
  const T = THREE, clamp = T.MathUtils.clamp, mix = T.MathUtils.lerp;
  let seed = 63819;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const between = (a,b) => mix(a,b,random());
  const pick = arr => arr[Math.floor(random()*arr.length)];
  const west = z => -308 + 19*Math.sin(z/107) + 14*Math.cos(z/55) - 44*Math.exp(-((z+230)**2)/4400);
  const shore = (x,z) => Math.min(x-west(z), 655-x+31*Math.sin(z/81), 679-Math.abs(z+13)+34*Math.sin(x/74));
  function elevation(x,z) {
    const d=shore(x,z), land=clamp(d/36,0,1), hills=clamp((x+86)/446,0,1);
    return Math.max(-6,Math.min(0,d*.22)) + land*(3.6+.85*Math.sin(z/72)+.55*Math.sin(x/54))
      +land*hills*(19+17*Math.sin(x/112+z/130)+9*Math.cos(z/90))
      +land*47*Math.exp(-((x-392)**2+(z+267)**2)/27000);
  }
  const x0=-736,z0=-768,step=8,nx=191,nz=193,heights=new Float32Array(nx*nz);
  function geometry(pos,idx,colors) {
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);
    if(colors)g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
  }
  const tp=[],ti=[],col=new T.Color();
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
    const x=x0+i*step,z=z0+j*step,h=elevation(x,z),k=j*nx+i;heights[k]=h;tp.push(x,h,z);
    if(i<nx-1&&j<nz-1)ti.push(k,k+nx,k+1,k+1,k+nx,k+nx+1);
  }
  const landGeometry=geometry(tp,ti);
  const island=new T.Mesh(landGeometry,art.terrain(landGeometry,shore));island.receiveShadow=true;scene.add(island);
  function ground(x,z){
    const a=clamp((x-x0)/step,0,nx-1.001),b=clamp((z-z0)/step,0,nz-1.001);
    const i=Math.floor(a),j=Math.floor(b),u=a-i,v=b-j,k=j*nx+i;
    return u+v<1?heights[k]*(1-u-v)+heights[k+1]*u+heights[k+nx]*v:
      heights[k+nx+1]*(u+v-1)+heights[k+1]*(1-v)+heights[k+nx]*(1-u);
  }
  const roadLift=.16;
  const coastX=z=>west(z)+27;
  const N={port:[coastX(156),156],strand:[coastX(-40),-40],cape:[coastX(-284),-284],north:[-140,-489],
    hill:[142,-481],ridge:[395,-267],mills:[431,34],south:[285,315],bay:[72,421],quay:[coastX(358),358],
    plaza:[-54,52],orchard:[108,-190],market:[78,262],cliff:[8,-269]};
  const roads=[], roadIndex=new Map(), segments=[];
  const cellKey=(x,z)=>`${Math.floor(x/40)},${Math.floor(z/40)}`;
  function insert(index,obj,x,z,r){
    for(let i=Math.floor((x-r)/40);i<=Math.floor((x+r)/40);i++)for(let j=Math.floor((z-r)/40);j<=Math.floor((z+r)/40);j++){
      const k=`${i},${j}`;if(!index.has(k))index.set(k,[]);index.get(k).push(obj);
    }
  }
  const strips={asphalt:[[],[]],verge:[[],[]],paint:[[],[]],walk:[[],[]],kerb:[[],[]]};
  const at=(p,offset,lift)=>[p.x+p.rx*offset,ground(p.x+p.rx*offset,p.z+p.rz*offset)+lift,p.z+p.rz*offset];
  function ribbon(bucket,a,b,l,r,y){
    const [pos,idx]=strips[bucket],k=pos.length/3;pos.push(...at(a,l,y),...at(a,r,y),...at(b,l,y),...at(b,r,y));idx.push(k,k+1,k+2,k+1,k+3,k+2);
  }
  function road(id,label,start,end,via=[],width=8.6){
    const coords=[N[start],...via,N[end]].map(([x,z])=>new T.Vector3(x,0,z));
    const curve=new T.CatmullRomCurve3(coords,false,'centripetal');const length=curve.getLength(),n=Math.ceil(length/3.25),pts=[];
    const junctions=Object.values(N);
    for(let i=0;i<=n;i++){
      const p=curve.getPointAt(i/n),v=curve.getTangentAt(i/n),a={x:p.x,z:p.z,rx:-v.z,rz:v.x};pts.push(a);
      if(!i)continue;
      const b=pts[i-1],s={a:b,b:a,road:id,width,label};segments.push(s);insert(roadIndex,s,(a.x+b.x)/2,(a.z+b.z)/2,18);
      ribbon('verge',b,a,-width/2-.9,width/2+.9,.095);ribbon('asphalt',b,a,-width/2,width/2,roadLift);
      if(junctions.some(([x,z])=>(x-p.x)**2+(z-p.z)**2<95))continue;
      if(id==='palm'||id==='prom'){ribbon('walk',b,a,-width/2-3.3,-width/2-.25,.18);ribbon('kerb',b,a,-width/2-.36,-width/2-.05,.21);}
      if(['prom','palm','portTown','market','village'].includes(id)){
        ribbon('walk',b,a,width/2+.10,width/2+3.3,.18);ribbon('kerb',b,a,width/2+.02,width/2+.35,.21);
        if(i===4||i===n-3)for(let band=-3;band<=3;band++)ribbon('paint',b,a,band*.99-.28,band*.99+.28,.202);
      }
      if(i%4===1)ribbon('paint',b,a,-.084,.084,.198);
      for(let side of [-1,1]){const d=side*(width/2-.32);ribbon('paint',b,a,d-.057,d+.057,.197);}
    }
    const r={id,label,start,end,pts,width,length};roads.push(r);return r;
  }
  const coastal=(zs)=>zs.map(z=>[coastX(z),z]);
  road('prom','Via del Porto','quay','port',coastal([310,240]));
  road('palm','Palm Promenade','port','strand',coastal([111,65,14]));
  road('light','Lighthouse Road','strand','cape',coastal([-105,-166,-232]));
  road('north','Cape Road','cape','north',[[coastX(-337),-337],[coastX(-393)+19,-393],[-217,-440]]);
  road('high','North Pass','north','hill',[[-40,-524],[48,-515]]);
  road('ridge','Serra Switchbacks','hill','ridge',[[190,-428],[250,-440],[296,-397],[247,-345],[331,-326]]);
  road('mills','Turbine Ridge','ridge','mills',[[457,-208],[422,-129],[480,-62]]);
  road('south','Valley Road','mills','south',[[373,99],[403,183],[348,247]]);
  road('bay','Bay View','south','bay',[[205,375],[164,408]]);
  road('harbor','Harbour Road','bay','quay',[[-58,433],[-163,407]]);
  road('portTown','Porto Vecchio','port','plaza',[[-209,131],[-135,100]]);
  road('market','Market Street','plaza','market',[[-36,124],[16,187]]);
  road('fields','Orchard Lane','plaza','orchard',[[-19,-45],[55,-106]],7.4);
  road('capeTown','Cypress Way','cape','cliff',[[-240,-270],[-144,-299],[-65,-294]],7.4);
  road('orchard','Hill Road','cliff','orchard',[[51,-247]],7.4);
  road('pass','Summit Road','orchard','ridge',[[195,-221],[269,-192],[338,-217]],8);
  road('farm','Farm Road','market','south',[[175,236],[241,270]],7.4);
  road('bayTown','Marina Link','market','bay',[[100,327]],7.4);
  road('village','Old Town Road','strand','plaza',[[-227,-51],[-172,-29],[-113,14]],7.4);
  const surfaces={asphalt:0x737578,verge:0xa79c83,paint:0xe7ddc2,walk:0xbaae98,kerb:0xd8ceba};
  let asphalt;
  for(const [key,[p,i]] of Object.entries(strips)){
    const g=geometry(p,i),mat=key==='asphalt'?art.roadMaterial():new T.MeshLambertMaterial({color:surfaces[key]});
    if(key==='asphalt'){const uv=[];for(let j=0;j<p.length;j+=3)uv.push(p[j]/5.5,p[j+2]/5.5);g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));}
    const mesh=new T.Mesh(g,mat);mesh.receiveShadow=true;scene.add(mesh);if(key==='asphalt')asphalt=mesh;
  }
  function nearest(x,z,global=false){
    const pool=global?segments:roadIndex.get(cellKey(x,z))||[];let best=null,dist2=Infinity;
    for(const s of pool){const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,t=clamp(((x-s.a.x)*dx+(z-s.a.z)*dz)/(dx*dx+dz*dz),0,1);
      const px=s.a.x+dx*t,pz=s.a.z+dz*t,d=(x-px)**2+(z-pz)**2;
      if(d<dist2){dist2=d;best={x:px,z:pz,d:Math.sqrt(d),heading:Math.atan2(dx,-dz),segment:s};}}
    return best;
  }

  // Repeated scenery is batched by geometry; only the vehicle needs detailed PBR materials.
  const stone=new T.DodecahedronGeometry(1,0), box=new T.BoxGeometry(1,1,1), pine=new T.ConeGeometry(1,1,8);
  const cylinder=new T.CylinderGeometry(1,1,1,12), trunk=new T.CylinderGeometry(.72,1,1,8);
  const round=new T.SphereGeometry(1,12,8),shrub=new T.IcosahedronGeometry(1,1),cypress=new T.SphereGeometry(1,15,13),tiles=new Map(),obstacles=new Map();
  for(const foliage of [shrub,cypress]){
    const p=foliage.attributes.position,colors=[];
    for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),noise=Math.sin(7*x+14*y)*Math.cos(11*z-9*y);
      const radius=1+.17*noise; p.setXYZ(i,x*radius,y*(1+.025*noise),z*radius);
      const value=.69+.16*y+.17*noise;colors.push(value*.95,value,value*.88);}
    foliage.setAttribute('color',new T.Float32BufferAttribute(colors,3));foliage.computeVertexNormals();
  }
  const dummy=new T.Object3D(),matrix=new T.Matrix4(),axis=new T.Vector3(0,1,0);
  function part(g,x,y,z,sx,sy,sz,color,ry=0,rz=0,rx=0){
    dummy.position.set(x,y,z);dummy.rotation.set(rx,ry,rz,'YXZ');dummy.scale.set(sx,sy,sz);dummy.updateMatrix();
    if(!tiles.has(g))tiles.set(g,[]);tiles.get(g).push([dummy.matrix.clone(),color]);
  }
  function beam(ax,ay,az,bx,by,bz,r,color){
    const delta=new T.Vector3(bx-ax,by-ay,bz-az);dummy.quaternion.setFromUnitVectors(axis,delta.clone().normalize());
    matrix.compose(new T.Vector3((ax+bx)/2,(ay+by)/2,(az+bz)/2),dummy.quaternion,new T.Vector3(r,delta.length(),r));
    if(!tiles.has(cylinder))tiles.set(cylinder,[]);tiles.get(cylinder).push([matrix.clone(),color]);
  }
  function solid(x,z,w,d,angle=0){insert(obstacles,{x,z,w,d,c:Math.cos(angle),s:Math.sin(angle)},x,z,Math.hypot(w,d)+3);}
  const disk=new T.CylinderGeometry(1,1,1,24);
  function contact(x,z,w,d){part(disk,x,ground(x,z)+.06,z,w,.018,d,0x737658);}
  // A folded frond silhouette reads at both road level and across the bay.
  const frondPos=[],frondIdx=[];const arch=t=>.43*Math.sin(t*Math.PI)-.19*t*t;
  for(let i=0;i<27;i++){
    const t=i/27,end=(i+1)/27,k=frondPos.length/3,width=.018+.19*Math.pow(Math.sin(Math.PI*(t+.016)),.68);
    frondPos.push(t,arch(t),-.012,t,arch(t),.012,end,arch(end),-.009,end,arch(end),.009);
    frondIdx.push(k,k+1,k+2,k+2,k+1,k+3);
    for(const s of [-1,1]){const v=frondPos.length/3,tip=Math.min(1.05,t+.12+.038*Math.cos(t*13+s));
      frondPos.push(t,arch(t),0,t+.049,arch(t)+.014,s*width*.65,tip,arch(t)-width*1.37,s*width,end,arch(end),s*.005);frondIdx.push(v,v+1,v+3,v+1,v+2,v+3);}
  }
  const frond=geometry(frondPos,frondIdx);
  function tree(x,z,type,size=1){const y=ground(x,z),h=size;
    if(type==='palm'){
      const lean=between(-.45,.45)*h;beam(x,y,z,x+lean,y+5.7*h,z,.18*h,0x9b8268);
      for(let j=0;j<15;j++){const f=j/15;part(trunk,x+lean*f,y+5.58*h*f+.04,z,.189*h,.065*h,.189*h,0x756756);}
      part(trunk,x+lean,y+5.34*h,z,.30*h,.85*h,.30*h,0x756646);
      for(let i=0;i<13;i++)part(frond,x+lean,y+5.65*h,z,(i<9?3.6:2.65)*h,2.3*h,4.8*h,pick([0x4d7752,0x5f8051,0x638b5b]),i*2.40+between(-.14,.14),i<9?between(-.28,.10):between(.32,.66));
    }else if(type==='cypress'){
      part(trunk,x,y+1.2*h,z,.21*h,2.4*h,.21*h,0x725f4f);part(cypress,x,y+4.25*h,z,1.03*h,3.9*h,.98*h,pick([0x4f7052,0x607e58,0x4d6d50]));
    }else{
      part(trunk,x,y+1.25*h,z,.26*h,2.5*h,.26*h,0x806d56);
      for(let i=0;i<3;i++)part(shrub,x+Math.sin(i*2.5)*h,y+(2.7+.48*i)*h,z+Math.cos(i*2.5)*h,2*h,1.5*h,2*h,pick([0x809363,0x74865e,0x667f54]),random()*6);
    }
    contact(x,z,type==='palm'?1.35:1.8,1.45);solid(x,z,.22*h,.22*h);
  }
  const gable=geometry([-.5,0,-.5,.5,0,-.5,0,.19,-.5,-.5,0,.5,.5,0,.5,0,.19,.5],[0,2,1,3,4,5]);
  function house(x,z,angle,w,d,h){const y=ground(x,z),c=Math.cos(angle),s=Math.sin(angle);
    const local=(a,b)=>[x+a*c+b*s,z-a*s+b*c];
    function block(a,dy,b,sx,sy,sz,color,tilt=0){const [px,pz]=local(a,b);part(box,px,y+dy,pz,sx,sy,sz,color,angle,tilt);}
    solid(x,z,w/2+.25,d/2+.25,angle);
    const stucco=pick([0xe7d9bf,0xdabf9b,0xf1e1c9,0xd6b3a0,0xdfcbb2]);block(0,h/2-.25,0,w,h+.5,d,stucco);part(gable,x,y+h,z,w,w,d,stucco,angle);
    const roof=pick([0xad654d,0xbe795c,0x996353]);
    for(let side of [-1,1])block(side*w*.25,h+.10*w,0,w*.56,.31,d+.8,roof,-side*.36);
    block(w*.28,h+.9,d*.22,.6,1.4,.65,0xd8bda5);
    for(let side of [-1,1])for(let ix=0;ix<3;ix++)for(let floor=0;floor<(h>5?2:1);floor++){
      const wx=(ix-1)*w*.30,wy=1.7+2.65*floor;
      block(wx,wy,side*(d/2+.04),1.05,1.38,.095,0x485c59);
      for(let k of [-1,1])block(wx+k*.69,wy,side*(d/2+.075),.28,1.43,.10,0x6f8277);
    }
    block(w*.29,1.05,d/2+.09,.84,2.1,.12,0x73675c);
    for(const side of [-1,1])for(const j of [-1,1])block(side*(w/2+.02),2.1,j*d*.24,.09,1.25,.86,0x526761);
    if(h>5){block(0,3.42,d/2+.52,w*.73,.18,1.25,0xbead93);block(0,4.24,d/2+1.05,w*.73,.07,.07,0x52605b);
      for(let j=-3;j<=3;j++)block(j*w*.114,3.83,d/2+1.05,.045,.83,.05,0x626964);}
  }
  const houses=[];
  buildWaterfront(scene,{roads,ground,nearest,shore,solid,houses,part,box,cylinder,tree});
  for(const r of roads.filter(r=>['portTown','village','market','prom','bayTown','harbor','capeTown'].includes(r.id))){
    for(let k=6;k<r.pts.length-4;k+=Math.floor(between(7,11))){
      const p=r.pts[k],side=r.id==='prom'?1:pick([-1,1]),off=side*between(15,22),x=p.x+p.rx*off,z=p.z+p.rz*off;
      const n=nearest(x,z);if(shore(x,z)<18||(n&&n.d<11)||houses.some(v=>Math.hypot(x-v.x,z-v.z)<(v.radius||9)+9))continue;
      houses.push({x,z});house(x,z,Math.atan2(-side*p.rx,-side*p.rz),between(6.4,9.7),between(6.5,10),pick([3.7,6.25,6.5]));
    }
  }
  for(const r of roads.filter(r=>['palm','prom','light','capeTown','fields','ridge'].includes(r.id))){
    for(let i=4;i<r.pts.length;i+=r.id==='palm'?6:9){const p=r.pts[i],side=['palm','prom','light'].includes(r.id)?-1:pick([-1,1]);
      const x=p.x+p.rx*side*8.7,z=p.z+p.rz*side*8.7;if(nearest(x,z)?.d<6.2)continue;
      tree(x,z,['palm','prom','light'].includes(r.id)?'palm':'cypress',between(.87,1.23));}
  }
  for(let i=0;i<1150;i++){
    const x=between(-330,630),z=between(-625,626),n=nearest(x,z);
    if(shore(x,z)<22||(n&&n.d<12)||houses.some(p=>Math.hypot(x-p.x,z-p.z)<(p.radius||9)+3))continue;
    tree(x,z,random()<.52?'cypress':'olive',between(.65,1.48));
  }
  for(const r of roads.filter(r=>r.id==='palm'||r.id==='prom')){
    for(let i=5;i<r.pts.length-4;i+=11){const p=r.pts[i],x=p.x-7.7*p.rx,z=p.z-7.7*p.rz,y=ground(x,z);
      beam(x,y,z,x,y+4.0,z,.075,0x535f58);beam(x,y+3.84,z,x+p.rx*.65,y+4.02,z+p.rz*.65,.046,0x535f58);
      part(round,x+p.rx*.67,y+3.98,z+p.rz*.67,.28,.085,.28,0xe8e0c3);solid(x,z,.08,.08);
    }
  }
  function sign(x,z,yaw,text){const y=ground(x,z);part(cylinder,x,y+1.25,z,.072,2.5,.072,0x8a9089);
    const cv=document.createElement('canvas');cv.width=512;cv.height=128;const c=cv.getContext('2d');
    c.fillStyle='#315651';c.fillRect(0,0,512,128);c.strokeStyle='#d7dcc6';c.lineWidth=5;c.strokeRect(8,8,496,112);c.font='600 44px Arial';c.textAlign='center';c.fillStyle='#faf0da';c.fillText(text,256,79);
    const tex=new T.CanvasTexture(cv);tex.colorSpace=T.SRGBColorSpace;const obj=new T.Mesh(new T.PlaneGeometry(4.4,1.1),new T.MeshLambertMaterial({map:tex,side:T.DoubleSide}));obj.position.set(x,y+2.7,z);obj.rotation.y=yaw;scene.add(obj);solid(x,z,.10,.10);
  }
  for(const [id,label] of [['palm','FARO  ↑'],['portTown','PORTO VECCHIO  ↑'],['ridge','SERRA ALTA  ↑'],['bay','MARINA  ↑']]){
    const r=roads.find(r=>r.id===id),p=r.pts[12];sign(p.x+p.rx*6.2,p.z+p.rz*6.2,Math.atan2(-p.rz,p.rx),label);
  }
  const lighthouse=[west(-244)+12,-244];{
    const [x,z]=lighthouse,y=ground(x,z);part(cylinder,x,y+.34,z,3.05,.68,3.05,0xa69a85);
    for(let i=0;i<7;i++)part(cylinder,x,y+1.7+2.05*i,z,2.12-i*.105,2.08,2.12-i*.105,i===4||i===5?0xb75e46:0xf0e5cb);
    part(cylinder,x,y+15.08,z,2.22,.42,2.22,0x494e4b);part(cylinder,x,y+16,z,1.26,1.66,1.26,0xa1c1b9);
    for(let a=0;a<6;a++){const q=a*Math.PI/3;part(trunk,x+1.16*Math.sin(q),y+16,z+1.16*Math.cos(q),.085,1.72,.085,0x384d4a);}
    part(pine,x,y+17.47,z,1.85,1.38,1.85,0xb35d46);solid(x,z,2.2,2.2);
  }
  // Marina pontoons and moored sailing boats sit below the coast road.
  for(const z of [63,102,229]){const sx=west(z)+1;part(box,sx-13,.70,z,29,.42,2.1,0xa99377);
    for(let i=0;i<=5;i++)for(let k of [-1,1])part(cylinder,sx-5*i,.22,z+k*.95,.16,2,.16,0x6c6150);
    for(let i=0;i<4;i++){
      const bx=sx-8-i*5.5,bz=z+(i%2?5.3:-5.1);part(round,bx,.14,bz,1.10,.59,3.1,pick([0xc7cec2,0xe9dfc7,0x788e92]));
      part(box,bx,.63,bz+.2,1.28,.63,1.72,0xe9dfca);part(cylinder,bx,3.03,bz,.055,5.8,.055,0x786c5e);
      beam(bx,.73,bz-2.28,bx,5.88,bz,.017,0xbabbb0);
    }
  }
  const turbines=[];for(const [x,z] of [[473,-40],[510,-111],[477,-201]]){
    const y=ground(x,z);part(trunk,x,y+15,z,1.10,30,1.1,0xe7e5d8);solid(x,z,1.1,1.1);
    const rotor=new T.Group();rotor.position.set(x,y+30,z+1);rotor.rotation.y=-.38;scene.add(rotor);turbines.push(rotor);
    const m=new T.MeshLambertMaterial({color:0xece9dc});for(let i=0;i<3;i++){
      const blade=new T.Mesh(new T.ConeGeometry(.66,12,4).translate(0,6,0),m);blade.rotation.z=i*2.0944;rotor.add(blade);}
  }
  for(let i=0;i<95;i++){const z=between(-660,642),x=west(z)-between(-3,14),r=between(.5,2.1);part(stone,x,-.1,z,r,.66*r,r*.75,0xa09b8b,random()*6);}
  const blades=[],bladeIdx=[],bladeColors=[];
  for(let i=0;i<17;i++){const a=i*2.39996,x=.38*Math.cos(a)*random(),z=.38*Math.sin(a)*random(),k=blades.length/3,h=between(.26,.73);
    blades.push(x-.041,0,z,x+.041,0,z,x+.12*Math.cos(a),h*.74,z+.09*Math.sin(a),x+.23*Math.cos(a),h,z+.20*Math.sin(a));
    bladeIdx.push(k,k+1,k+2,k+1,k+3,k+2);bladeColors.push(.48,.51,.44,.48,.51,.44,.9,.91,.80,1,1,.91);}
  const grass=geometry(blades,bladeIdx,bladeColors);
  for(const r of roads)for(const p of r.pts){for(const side of [-1,1]){
    const offset=side*between(9,16),x=p.x+p.rx*offset,z=p.z+p.rz*offset;
    if(shore(x,z)<8||nearest(x,z)?.d<8||houses.some(b=>Math.hypot(x-b.x,z-b.z)<(b.radius||9)+2))continue;
    for(let i=0;i<3;i++){const px=x+between(-1.2,1.2),pz=z+between(-1.2,1.2),size=between(.53,1.02);part(grass,px,ground(px,pz),pz,size,size,size,pick([0x778651,0x889157,0x948d62]),random()*6);}
  }}
  const instMat=new T.MeshLambertMaterial({side:T.DoubleSide}),leafMat=new T.MeshLambertMaterial({side:T.DoubleSide,vertexColors:true});
  for(const [g,list] of tiles){const m=new T.InstancedMesh(g,g.attributes.color?leafMat:instMat,list.length);m.castShadow=g!==disk&&g!==grass;m.receiveShadow=g!==disk;list.forEach(([mat,color],i)=>{m.setMatrixAt(i,mat);m.setColorAt(i,col.setHex(color));});scene.add(m);}
  function blocked(x,z,r=.83){
    return (obstacles.get(cellKey(x,z))||[]).some(o=>{const dx=x-o.x,dz=z-o.z,px=dx*o.c-dz*o.s,pz=dx*o.s+dz*o.c;
      return (Math.max(0,Math.abs(px)-o.w)**2+Math.max(0,Math.abs(pz)-o.d)**2)<r*r;});
  }
  const water=new T.Mesh(new T.PlaneGeometry(7000,7000),art.seaMaterial());water.rotation.x=-Math.PI/2;water.position.y=-.34;scene.add(water);
  return {roads,N,ground,shore,west,nearest,blocked,roadLift,lighthouse,turbines,water,asphalt,
    spawn:roads.find(r=>r.id==='palm').pts[7], bounds:{minX:-426,maxX:600,minZ:-623,maxZ:546}};
}
