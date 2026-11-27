/* Ocean Drive: street-facing Deco buildings, glazed apartment towers and a hotel strip. */
function buildWaterfront(scene, {roads,ground,nearest,shore,solid,houses,part,box,cylinder,tree}) {
  const T=THREE;
  let seed=38571;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const choose=a=>a[Math.floor(random()*a.length)];
  function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
  function texture(image,repeat=false){const t=new T.CanvasTexture(image);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;
    if(repeat)t.wrapS=t.wrapT=T.RepeatWrapping;return t;}
  // A baked eight-bay atlas gives each room a sill, glazing, drawn curtains and an interior.
  const rooms=canvas(1024,512),emission=canvas(1024,512),rc=rooms.getContext('2d'),ec=emission.getContext('2d');
  ec.fillStyle='#000';ec.fillRect(0,0,1024,512);
  for(let row=0;row<4;row++)for(let col=0;col<8;col++){
    const x=col*128,y=row*128,lit=random()<.43;
    rc.fillStyle=choose(['#918b8b','#aca49e','#8f979a']);rc.fillRect(x,y,128,128);
    rc.fillStyle='#3c454a';rc.fillRect(x+6,y+7,116,97);
    const glass=rc.createLinearGradient(x,y+10,x+51,y+94);
    glass.addColorStop(0,lit?'#99795e':'#8190a0');glass.addColorStop(.46,lit?'#dec39a':'#687480');glass.addColorStop(1,lit?'#816b55':'#354554');
    rc.fillStyle=glass;rc.fillRect(x+10,y+11,108,87);
    const curtain=8+random()*39;rc.fillStyle=lit?'#a68e73':'#54616b';rc.fillRect(x+11,y+12,curtain,86);
    rc.fillStyle=lit?'#c8b399':'#6c767e';for(let k=0;k<curtain-2;k+=5)rc.fillRect(x+12+k,y+12,2,84);
    rc.fillStyle='#313840';rc.fillRect(x+57,y+74,32,18);rc.fillStyle='#514833';rc.fillRect(x+91,y+62,3,25);
    rc.fillStyle=lit?'#f7cc8a':'#898e88';rc.fillRect(x+85,y+54,16,10);
    rc.fillStyle='#3a424a';rc.fillRect(x+63,y+10,3,90);rc.fillRect(x+10,y+30,108,2);
    rc.fillStyle='#cbc2b4';rc.fillRect(x+3,y+103,122,4);rc.fillStyle='#6a6968';rc.fillRect(x,y+108,128,4);
    if(lit){ec.drawImage(rooms,x+10,y+11,108,87,x+10,y+11,108,87);}
  }
  const vitrage=new T.MeshStandardMaterial({map:texture(rooms,true),emissiveMap:texture(emission,true),emissive:0xffc597,emissiveIntensity:.56,metalness:.28,roughness:.34});
  // The shop glazing reveals a second, deeper layer: tiled floors, shelves, bottles and lamps.
  const shop=canvas(1024,256),shopCtx=shop.getContext('2d');
  const wall=shopCtx.createLinearGradient(0,0,0,256);wall.addColorStop(0,'#63534c');wall.addColorStop(.27,'#b89776');wall.addColorStop(.68,'#9b7e66');wall.addColorStop(1,'#4b4945');shopCtx.fillStyle=wall;shopCtx.fillRect(0,0,1024,256);
  shopCtx.fillStyle='#514c45';shopCtx.fillRect(0,170,1024,12);shopCtx.fillStyle='#54453e';shopCtx.fillRect(0,119,1024,5);shopCtx.fillRect(0,76,1024,5);
  for(let i=0;i<145;i++){const x=random()*1024,base=i%2?119:76,h=9+random()*17;shopCtx.fillStyle=choose(['#6c776a','#817061','#846653','#aca192','#5b6967']);shopCtx.fillRect(x,base-h,5,h);shopCtx.fillRect(x+1,base-h-4,3,4);}
  for(let i=0;i<8;i++){const x=64+i*128;shopCtx.fillStyle='#493d37';shopCtx.fillRect(x,0,2,30);shopCtx.fillStyle='#f6d19a';shopCtx.beginPath();shopCtx.ellipse(x,32,19,8,0,Math.PI,2*Math.PI);shopCtx.fill();
    shopCtx.fillStyle='#72554c';shopCtx.fillRect(x-31,150,56,28);shopCtx.fillStyle='#4f4541';shopCtx.fillRect(x-31,176,56,5);shopCtx.fillRect(x-27,178,3,14);shopCtx.fillRect(x+18,178,3,14);}
  const fronts=[],frontUV=[],frontIdx=[],shopMap=texture(shop);
  const glassPos=[],glassUV=[],glassIdx=[];
  function windows(a,b,base,h,bays,floors){const k=glassPos.length/3;
    glassPos.push(a[0],base,a[1],b[0],base,b[1],b[0],base+h,b[1],a[0],base+h,a[1]);
    const u=Math.floor(random()*8)/8,v=Math.floor(random()*4)/4;glassUV.push(u,v,u+bays/8,v,u+bays/8,v+floors/4,u,v+floors/4);glassIdx.push(k,k+1,k+2,k,k+2,k+3);}
  const curbShape=new T.Shape();curbShape.moveTo(-.40,-.50);curbShape.lineTo(.40,-.50);curbShape.quadraticCurveTo(.5,-.50,.5,-.38);
  curbShape.lineTo(.5,.38);curbShape.quadraticCurveTo(.5,.50,.40,.50);curbShape.lineTo(-.40,.50);curbShape.quadraticCurveTo(-.50,.50,-.50,.38);curbShape.lineTo(-.5,-.38);curbShape.quadraticCurveTo(-.5,-.5,-.4,-.5);
  const streamlined=new T.ExtrudeGeometry(curbShape,{depth:1,bevelEnabled:false,curveSegments:5}).rotateX(-Math.PI/2).translate(0,-.5,0);
  const tubePos=[],tubeColor=[],tubeIdx=[];
  function neon(a,b,y,width,hex){const k=tubePos.length/3,c=new T.Color(hex).multiplyScalar(1.85);
    tubePos.push(a[0],y-width,a[1],b[0],y-width,b[1],b[0],y+width,b[1],a[0],y+width,a[1]);
    for(let i=0;i<4;i++)tubeColor.push(c.r,c.g,c.b);tubeIdx.push(k,k+1,k+2,k,k+2,k+3);}
  const labelCache=new Map();
  function nameplate(name,caption,w,h,x,y,z,angle,color){
    const key=name+caption;
    if(!labelCache.has(key)){
      const image=canvas(768,192),c=image.getContext('2d');c.fillStyle='#172b39';c.fillRect(0,0,768,192);
      c.strokeStyle=color;c.lineWidth=3;c.strokeRect(8,8,752,176);c.globalAlpha=.35;c.strokeRect(16,16,736,160);c.globalAlpha=1;
      c.font='italic 70px Georgia';c.textAlign='center';c.shadowBlur=9;c.shadowColor=color;c.fillStyle=color;c.fillText(name,384,104,690);
      c.shadowBlur=0;c.font='bold 21px Arial';c.fillStyle='#f6e4ce';c.fillText(caption,384,148,670);
      labelCache.set(key,new T.MeshBasicMaterial({map:texture(image),side:T.DoubleSide}));
    }
    const panel=new T.Mesh(new T.PlaneGeometry(w,h),labelCache.get(key));panel.position.set(x,y,z);panel.rotation.y=angle;scene.add(panel);
  }
  const names=[['Solara','O C E A N   H O T E L','#ff9db6'],['Blue Hour','B E A C H   C L U B','#87eadf'],['The Marlin','R O O M S   &   S U I T E S','#ffb899'],['Paloma','P O O L S I D E   M O T E L','#a6eee2'],['Miramar','O C E A N   T E R R A C E','#ffb5cc'],['Coral Room','C A F É   •   B A R','#ffd19c']];
  function building(x,z,angle,w,d,floors,index,highrise=false){
    const y=ground(x,z),cs=Math.cos(angle),sn=Math.sin(angle),height=floors*2.92+3.42;
    const pt=(u,v)=>[x+u*cs+v*sn,z-u*sn+v*cs];
    const block=(geom,u,dy,v,sw,sh,sd,color)=>{const q=pt(u,v);part(geom,q[0],y+dy,q[1],sw,sh,sd,color,angle);};
    const stucco=choose([0xf1c1ad,0xc0d8cc,0xe5d2bc,0xdfb9b9,0xe6dac6]),trim=0xe6dace;
    const theme=names[index%names.length],neonColor=new T.Color(theme[2]).getHex();
    solid(x,z,w*.5+.5,d*.5+.45,angle);
    block(streamlined,0,-.22,0,w+3,.65,d+3,0xb9a89b);
    block(streamlined,0,height*.5-.28,0,w,height+.56,d,stucco);
    const faces=[[[w*.46,d/2],[-w*.46,d/2]],[[-w*.46,-d/2],[w*.46,-d/2]],[[w/2,-d*.40],[w/2,d*.40]],[[-w/2,d*.40],[-w/2,-d*.40]]];
    for(const [v1,v2] of faces){const a=pt(v2[0]*1.005,v2[1]*1.005),b=pt(v1[0]*1.005,v1[1]*1.005);
      windows(a,b,y+3.5,height-3.65,Math.max(2,Math.round(Math.hypot(a[0]-b[0],a[1]-b[1])/2.7)),floors);}
    for(let l=0;l<=floors;l++){
      const h=3.38+l*2.92;
      block(streamlined,0,h,0,w+.56,.25,d+.7,trim);
      if(!highrise&&l%2===0)neon(pt(-w*.44,d*.5+.36),pt(w*.44,d*.5+.36),y+h,.035,neonColor);
    }
    block(streamlined,0,height+.28,0,w+.74,.45,d+.78,trim);
    block(box,-w*.18,height+1.35,-d*.12,w*.36,2.4,d*.46,stucco);
    block(box,-w*.18,height+2.62,-d*.12,w*.38,.18,d*.48,trim);
    for(let i=0;i<3;i++)block(box,w*.28,height+.52,(i-1)*d*.21,1.6,.94,1.45,0x828987);
    if(highrise)return;
    block(streamlined,0,-.10,d*.5+2.05,w+1.6,.30,5.65,0xc7b8aa);
    // Streamlined parapet, vertical fins and a cantilevered entrance marquee.
    block(streamlined,0,height*.55,d*.49,w*.16,height*1.1,1.45,stucco);
    for(let j=-1;j<=1;j++)block(box,j*.54,height*.58,d*.5+.73,.19,height*1.14-Math.abs(j)*1.35,.29,trim);
    block(streamlined,0,3.15,d*.5+.68,w*.96,.44,3.4,trim);
    neon(pt(-w*.43,d*.5+2.35),pt(w*.43,d*.5+2.35),y+3.15,.075,neonColor);
    for(let j=-2;j<=2;j++){
      const px=j*w*.174;block(box,px,1.47,d*.5+.02,w*.152,2.66,.18,0x455861);
      const a=pt(px-w*.074,d*.5+.116),b=pt(px+w*.074,d*.5+.116),k=fronts.length/3,l=(j+2)/5;
      fronts.push(a[0],y+.22,a[1],b[0],y+.22,b[1],b[0],y+2.72,b[1],a[0],y+2.72,a[1]);frontUV.push(l,0,l+.2,0,l+.2,1,l,1);frontIdx.push(k,k+1,k+2,k,k+2,k+3);
      block(box,px,1.10,d*.5+.13,w*.152,.081,.07,0xb49b7e);block(box,px,1.48,d*.5+.13,.075,2.65,.08,0xaaa8a0);
    }
    const q=pt(0,d*.5+2.43);nameplate(theme[0],theme[1],Math.min(11,w*.62),2.28,q[0],y+4.53,q[1],angle,theme[2]);
    // A double-sided blade sign can be read while approaching parallel to the frontage.
    const blade=pt(w*.40,d*.5+1.14);block(box,w*.40,6.07,d*.5+1.14,.32,2.5,3.8,0x23424b);
    nameplate(theme[0],'O C E A N   D R I V E',3.72,1.55,blade[0]+cs*.19,y+6.18,blade[1]-sn*.19,angle+Math.PI/2,theme[2]);
    const bench=pt(-w*.31,d*.5+2.7);part(box,bench[0],ground(...bench)+.50,bench[1],2.45,.24,.65,0x8a7060,angle);
    for(const side of [-1,1]){const q=pt(side*w*.41,d*.5+3.2),base=ground(...q);part(cylinder,q[0],base+.32,q[1],.46,.64,.46,0xba937c);
      for(let j=0;j<8;j++){const a=j*2.4;part(streamlined,q[0]+Math.cos(a)*.18,base+.91,q[1]+Math.sin(a)*.18,.12,.76,.14,0x657955,a,.27*Math.sin(a),.36*Math.cos(a));}}
  }
  function available(x,z,r){const road=nearest(x,z,true);return shore(x,z)>17&&road.d>r+road.segment.width*.5+1&&!houses.some(b=>Math.hypot(x-b.x,z-b.z)<r+b.radius+2);}
  let number=0;
  for(const id of ['prom','palm','light','harbor','portTown','village','market']){
    const road=roads.find(r=>r.id===id);const step=id==='palm'||id==='prom'?10:14;
    for(let i=4;i<road.pts.length-3;i+=step){
      const p=road.pts[i],coastal=['prom','palm','light'].includes(id),side=coastal?1:(i%3?1:-1);
      const w=16+random()*9,d=9+random()*5,r=Math.hypot(w,d)/2,offset=side*(r+8+random()*2);
      const x=p.x+p.rx*offset,z=p.z+p.rz*offset;if(!available(x,z,r))continue;
      houses.push({x,z,radius:r});building(x,z,Math.atan2(-side*p.rx,-side*p.rz),w,d,2+Math.floor(random()*3),number++);
    }
  }
  // Setback towers give each district a silhouette and visible landmarks from the mountain roads.
  for(const [cx,cz,count] of [[-172,128,19],[-150,-82,17],[32,337,16],[39,13,10]]){
    for(let i=0;i<count;i++){
      const x=cx+(random()-.5)*138,z=cz+(random()-.5)*140,w=13+random()*14,d=11+random()*10,r=Math.hypot(w,d)/2;
      if(!available(x,z,r))continue;houses.push({x,z,radius:r});
      building(x,z,.08+Math.floor(random()*3)*.31,w,d,5+Math.floor(random()*10),number++,true);
    }
  }
  if(glassPos.length){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(glassPos,3));g.setAttribute('uv',new T.Float32BufferAttribute(glassUV,2));g.setIndex(glassIdx);g.computeVertexNormals();vitrage.side=T.DoubleSide;
    const windows=new T.Mesh(g,vitrage);windows.receiveShadow=true;scene.add(windows);}
  if(fronts.length){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(fronts,3));g.setAttribute('uv',new T.Float32BufferAttribute(frontUV,2));g.setIndex(frontIdx);g.computeVertexNormals();const m=new T.MeshStandardMaterial({map:shopMap,emissiveMap:shopMap,emissive:0xffcca0,emissiveIntensity:.65,metalness:.32,roughness:.27,side:T.DoubleSide});scene.add(new T.Mesh(g,m));}
  if(tubePos.length){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(tubePos,3));g.setAttribute('color',new T.Float32BufferAttribute(tubeColor,3));g.setIndex(tubeIdx);scene.add(new T.Mesh(g,new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide})));}
  // Striped beach umbrellas, loungers and boardwalk planters furnish the sea side of the street.
  const shade=new T.ConeGeometry(1,.40,12,1,true),colors=[0xe68e86,0xeacbb4,0x7fb3ad];
  for(const id of ['palm','prom']){
    const road=roads.find(r=>r.id===id);
    for(let i=4;i<road.pts.length-4;i+=8){const p=road.pts[i],off=15.5+random()*3,x=p.x-p.rx*off,z=p.z-p.rz*off,y=ground(x,z);
      part(cylinder,x,y+1.05,z,.046,2.1,.046,0x806950);part(shade,x,y+2.19,z,1.66,1.6,1.66,choose(colors));solid(x,z,.06,.06);
      for(const side of [-1,1])part(box,x+p.rz*1.13*side,y+.29,z-p.rx*1.13*side,.69,.17,1.86,0xe1ccad,Math.atan2(p.rx,p.rz));
      const ax=p.x+p.rx*6.5,az=p.z+p.rz*6.5;if(nearest(ax,az)?.d<5.8)continue;
      part(cylinder,ax,ground(ax,az)+.28,az,.62,.55,.62,0xc9ac94);tree(ax,az,'palm',.85+random()*.30);
    }
  }
}
