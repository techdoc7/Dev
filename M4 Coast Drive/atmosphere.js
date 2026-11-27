/* Shared sky, materials and reflections for the sunset coast. All photographs are embedded. */
async function loadCoastalLight(renderer, scene) {
  const T = THREE;
  const maps = {};
  await Promise.all(Object.entries(window.COAST_ART).map(async ([name, uri]) => {
    const texture = await new T.TextureLoader().loadAsync(uri);
    texture.colorSpace = name === 'asphaltNormal' ? T.NoColorSpace : T.SRGBColorSpace;
    texture.wrapS = T.RepeatWrapping;
    if (name !== 'sky') texture.wrapT = T.RepeatWrapping;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    maps[name] = texture;
  }));
  delete window.COAST_ART;
  // Rotate the photographed sun towards the northwest end of the promenade.
  const image = maps.sky.image, panorama = document.createElement('canvas');
  panorama.width = image.width; panorama.height = image.height;
  const ctx = panorama.getContext('2d'), shift = Math.round(image.width * .439);
  ctx.drawImage(image, -shift, 0); ctx.drawImage(image, image.width - shift, 0);
  maps.sky.dispose();maps.sky = new T.CanvasTexture(panorama);
  maps.sky.colorSpace = T.SRGBColorSpace;maps.sky.mapping = T.EquirectangularReflectionMapping;
  maps.sky.wrapS = T.RepeatWrapping;
  scene.background = maps.sky;scene.backgroundIntensity = .95;
  const pmrem = new T.PMREMGenerator(renderer);
  const environment = pmrem.fromEquirectangular(maps.sky);scene.environment = environment.texture;
  scene.environmentIntensity = .93;
  const sun = new T.Vector3(-.34, .146, -.94).normalize();

  function terrain(geo, shore) {
    const pos = geo.attributes.position, uv = [], grass = [];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      uv.push(x / 12, z / 12);grass.push(T.MathUtils.smoothstep(shore(x,z), 13, 26));
    }
    geo.setAttribute('uv', new T.Float32BufferAttribute(uv,2));
    geo.setAttribute('meadowWeight', new T.Float32BufferAttribute(grass,1));
    const mat = new T.MeshLambertMaterial({map:maps.turf,color:0xfff9ed});
    mat.onBeforeCompile = shader => {
      shader.uniforms.beachMap = {value:maps.sand};
      shader.vertexShader = 'attribute float meadowWeight; varying float vMeadow;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvMeadow=meadowWeight;');
      shader.fragmentShader = 'uniform sampler2D beachMap; varying float vMeadow;\n'+shader.fragmentShader.replace('#include <map_fragment>',`
        vec3 pasture=texture2D(map,vMapUv).rgb;
        vec3 sand=texture2D(beachMap,vMapUv*2.1).rgb;
        float broad=texture2D(map,vMapUv*.115).g;
        diffuseColor.rgb*=mix(sand*1.55+.08,pasture*(1.13+broad*1.6),smoothstep(.02,.96,vMeadow+(broad-.18)*.5));`);
    };return mat;
  }

  // One small reflected view supplies actual building, palm and vehicle silhouettes to puddles.
  // The same projection is retained between updates so highlights stay anchored in the world.
  const target = new T.WebGLRenderTarget(480,270,{type:T.UnsignedByteType});
  const projection = new T.Matrix4(), reflected = new T.PerspectiveCamera();
  const plane = new T.Plane(), normal = new T.Vector3(), point = new T.Vector3(), direction = new T.Vector3();
  const clip = new T.Vector4(), corner = new T.Vector4(), reflectionAmount = {value:0};
  const rainNoise = `float patchHash(vec2 p){return fract(sin(dot(mod(p,8192.),vec2(41.31,137.17)))*13687.214);}
    float patchNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(patchHash(i),patchHash(i+vec2(1,0)),f.x),mix(patchHash(i+vec2(0,1)),patchHash(i+1.),f.x),f.y);}`;
  function roadMaterial() {
    const mat = new T.MeshStandardMaterial({map:maps.asphalt,normalMap:maps.asphaltNormal,normalScale:new T.Vector2(.48,.48),color:0x9498a0,roughness:.78,envMapIntensity:.66});
    mat.onBeforeCompile = shader => {
      Object.assign(shader.uniforms,{reflectionMap:{value:target.texture},roadProjection:{value:projection},reflectionAmount});
      shader.vertexShader = 'uniform mat4 roadProjection; varying vec3 roadPos; varying vec4 roadClip;\n'+shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
        roadPos=(modelMatrix*vec4(transformed,1.)).xyz; roadClip=roadProjection*vec4(roadPos,1.);`);
      shader.fragmentShader = 'uniform sampler2D reflectionMap; uniform float reflectionAmount; varying vec3 roadPos; varying vec4 roadClip;\n'+rainNoise+'\n'+shader.fragmentShader
        .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
          float waterLevel=patchNoise(roadPos.xz*vec2(.21,.12))*.68+patchNoise(roadPos.xz*.68)*.23+patchNoise(roadPos.xz*2.2)*.09;
          float wet=smoothstep(.46,.72,waterLevel);roughnessFactor=mix(.87,.17,wet);diffuseColor.rgb*=mix(.94,.42,wet);`)
        .replace('#include <opaque_fragment>',`
          vec2 uv=roadClip.xy/max(roadClip.w,.001)*.5+.5;
          vec2 grain=texture2D(normalMap,vNormalMapUv).rg-.5;
          float valid=step(.0,roadClip.w)*smoothstep(.0,.04,min(min(uv.x,uv.y),min(1.-uv.x,1.-uv.y)));
          vec3 reflectedScene=texture2D(reflectionMap,clamp(uv+grain*.008,.002,.998)).rgb;
          float fresnel=pow(1.-clamp(dot(normal,normalize(vViewPosition)),0.,1.),2.2);
          outgoingLight=mix(outgoingLight,reflectedScene,wet*(.065+.48*fresnel)*valid*reflectionAmount);
          #include <opaque_fragment>`);
    };return mat;
  }
  function reflect(camera, world, vehicle) {
    const p=vehicle.position;point.set(p.x,world.ground(p.x,p.z)+world.roadLift,p.z);
    normal.set((world.ground(p.x-1,p.z)-world.ground(p.x+1,p.z))*.5,1,(world.ground(p.x,p.z-1)-world.ground(p.x,p.z+1))*.5).normalize();
    plane.setFromNormalAndCoplanarPoint(normal,point);
    const distance=plane.distanceToPoint(camera.position);if(distance<.08){reflectionAmount.value=0;return;}
    camera.updateMatrixWorld();reflected.position.copy(camera.position).addScaledVector(normal,-2*distance);
    camera.getWorldDirection(direction).reflect(normal);reflected.up.set(0,1,0).applyQuaternion(camera.quaternion).reflect(normal);
    reflected.lookAt(direction.add(reflected.position));reflected.updateMatrixWorld();reflected.projectionMatrix.copy(camera.projectionMatrix);
    projection.multiplyMatrices(reflected.projectionMatrix,reflected.matrixWorldInverse);
    plane.applyMatrix4(reflected.matrixWorldInverse);clip.set(plane.normal.x,plane.normal.y,plane.normal.z,plane.constant);
    const m=reflected.projectionMatrix.elements;corner.set((Math.sign(clip.x)+m[8])/m[0],(Math.sign(clip.y)+m[9])/m[5],-1,(1+m[10])/m[14]);
    clip.multiplyScalar(2/clip.dot(corner));m[2]=clip.x;m[6]=clip.y;m[10]=clip.z+1-.002;m[14]=clip.w;
    reflected.projectionMatrixInverse.copy(reflected.projectionMatrix).invert();
    world.asphalt.visible=false;renderer.setRenderTarget(target);renderer.render(scene,reflected);renderer.setRenderTarget(null);world.asphalt.visible=true;reflectionAmount.value=1;
  }
  function seaMaterial() {
    return new T.ShaderMaterial({uniforms:{clock:{value:0},skyImage:{value:maps.sky},sunDirection:{value:sun}},
      vertexShader:`varying vec3 wp; void main(){wp=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.);}`,
      fragmentShader:`varying vec3 wp;uniform float clock;uniform sampler2D skyImage;uniform vec3 sunDirection;
        void main(){vec2 p=wp.xz;float t=clock*.72;vec3 eye=normalize(cameraPosition-wp);float dist=distance(cameraPosition,wp);
          vec2 swell=vec2(sin(dot(p,vec2(.17,.35))+t),sin(dot(p,vec2(.32,-.18))-t*.8));
          vec2 chop=vec2(cos(p.y*1.42+p.x*.52+t*1.68+swell.y),sin(p.x*.83-p.y*.64+t+swell.x));
          vec3 n=normalize(vec3(swell.x*.076+chop.x*.058,1.,swell.y*.087+chop.y*.06));vec3 r=reflect(-eye,n);r.y=abs(r.y);
          vec2 uv=vec2(atan(r.z,r.x)/6.283185+.5,asin(clamp(r.y,0.,1.))/3.14159+.5);
          vec3 sky=texture2D(skyImage,uv).rgb;float fres=pow(1.-max(dot(n,eye),0.),3.3);
          float coast=-308.+19.*sin(p.y/107.)+14.*cos(p.y/55.)-44.*exp(-pow((p.y+230.)/66.33,2.));float offshore=coast-p.x;
          vec3 sea=mix(vec3(.035,.265,.225),vec3(.012,.080,.112),smoothstep(0.,46.,offshore));
          float glitter=pow(max(dot(r,sunDirection),0.),220.);vec3 color=mix(sea,sky,.15+.59*fres)+vec3(1.,.55,.25)*glitter*.46;
          float strand=(1.-smoothstep(1.,8.,abs(offshore-2.5)))*smoothstep(.48,.98,sin(offshore*1.3+swell.x-t));color=mix(color,vec3(.64,.70,.66),strand*.62);
          color=mix(color,vec3(.40,.34,.45),smoothstep(380.,1800.,dist)*.42);gl_FragColor=vec4(color,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`});
  }
  // Reuse the same local probe as the driver enters another neighbourhood.
  const capture=new T.WebGLCubeRenderTarget(96),probe=new T.CubeCamera(.5,1600,capture);
  let filtered=null,probePosition=new T.Vector3(Infinity,Infinity,Infinity);
  function carReflection(vehicle) {
    if(vehicle.position.distanceToSquared(probePosition)<190*190)return;
    probePosition.copy(vehicle.position);
    probe.position.copy(vehicle.position);probe.position.y+=1.25;vehicle.visible=false;probe.update(renderer,scene);vehicle.visible=true;
    const initial=!filtered;filtered=pmrem.fromCubemap(capture.texture,filtered);
    if(initial)vehicle.traverse(o=>{if(o.isMesh&&o.material.isMeshStandardMaterial){o.material.envMap=filtered.texture;o.material.envMapIntensity=1.26;o.material.needsUpdate=true;}});
  }
  return {terrain,roadMaterial,seaMaterial,reflect,carReflection,reflectionAmount,sun};
}
