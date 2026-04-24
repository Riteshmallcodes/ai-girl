import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

function setExpression(vrm, key, value) {
  if (vrm?.expressionManager) {
    vrm.expressionManager.setValue(key, value);
    return;
  }
  if (vrm?.blendShapeProxy) {
    vrm.blendShapeProxy.setValue(key, value);
  }
}

function setBoneEuler(vrm, boneName, x = 0, y = 0, z = 0) {
  const bone = vrm?.humanoid?.getNormalizedBoneNode?.(boneName);
  if (!bone) return;
  bone.rotation.set(x, y, z);
}

function applyIdlePose(vrm) {
  setBoneEuler(vrm, 'spine', -0.02, 0.12, -0.04);
  setBoneEuler(vrm, 'chest', 0.03, 0.08, 0.02);
  setBoneEuler(vrm, 'neck', 0.02, -0.06, 0.05);
  setBoneEuler(vrm, 'head', 0.02, -0.1, 0.06);
  setBoneEuler(vrm, 'leftShoulder', 0.08, 0.0, 0.15);
  setBoneEuler(vrm, 'rightShoulder', 0.05, 0.0, -0.1);
  setBoneEuler(vrm, 'leftUpperArm', 0.34, 0.08, 1.08);
  setBoneEuler(vrm, 'rightUpperArm', 0.24, -0.05, -1.2);
  setBoneEuler(vrm, 'leftLowerArm', -0.42, 0.06, 0.2);
  setBoneEuler(vrm, 'rightLowerArm', -0.18, -0.04, -0.16);
  setBoneEuler(vrm, 'leftHand', 0.08, 0.0, 0.14);
  setBoneEuler(vrm, 'rightHand', 0.0, 0.0, -0.14);

  setBoneEuler(vrm, 'leftUpperLeg', 1.35, 0.1, -0.08);
  setBoneEuler(vrm, 'rightUpperLeg', 1.35, -0.1, 0.08);
  setBoneEuler(vrm, 'leftLowerLeg', -1.25, 0.0, 0.0);
  setBoneEuler(vrm, 'rightLowerLeg', -1.25, 0.0, 0.0);
}

function applyDancePose(vrm, elapsed) {
  const t = elapsed * 5.0; // beat tempo
  const phase = Math.floor(elapsed * 1.8) % 4; // Change move frequently

  // Different dynamic dance moves (hands & legs)
  if (phase === 0) {
    // Hands in air, pumping
    setBoneEuler(vrm, 'leftShoulder', 0, 0, 0.4);
    setBoneEuler(vrm, 'rightShoulder', 0, 0, -0.4);
    setBoneEuler(vrm, 'leftUpperArm', -2.8, 0, 0.5);
    setBoneEuler(vrm, 'rightUpperArm', -2.8, 0, -0.5);
    setBoneEuler(vrm, 'leftLowerArm', 0, 0, 0);
    setBoneEuler(vrm, 'rightLowerArm', 0, 0, 0);
    setBoneEuler(vrm, 'leftUpperLeg', -0.5, 0.2, -0.2);
    setBoneEuler(vrm, 'rightUpperLeg', 0.2, -0.2, 0.2);
  } else if (phase === 1) {
    // Disco point
    setBoneEuler(vrm, 'leftUpperArm', -2.5, 0, 1.5);
    setBoneEuler(vrm, 'leftLowerArm', -1.5, 0, 0);
    setBoneEuler(vrm, 'rightUpperArm', 0.5, 0, -1.0);
    setBoneEuler(vrm, 'rightLowerArm', -1.0, 0, 0);
    setBoneEuler(vrm, 'leftUpperLeg', 0.2, 0.2, -0.2);
    setBoneEuler(vrm, 'rightUpperLeg', -0.5, -0.2, 0.2);
  } else if (phase === 2) {
    // Wide arm swing
    setBoneEuler(vrm, 'leftUpperArm', -0.5, 0, 1.8);
    setBoneEuler(vrm, 'rightUpperArm', -0.5, 0, -1.8);
    setBoneEuler(vrm, 'leftLowerArm', -1.0, 0, 0);
    setBoneEuler(vrm, 'rightLowerArm', -1.0, 0, 0);
    setBoneEuler(vrm, 'leftUpperLeg', -0.2, 0, 0);
    setBoneEuler(vrm, 'rightUpperLeg', -0.2, 0, 0);
  } else {
    // Cross arms rap pose
    setBoneEuler(vrm, 'leftUpperArm', -1.0, 1.0, 0.5);
    setBoneEuler(vrm, 'rightUpperArm', -1.0, -1.0, -0.5);
    setBoneEuler(vrm, 'leftLowerArm', -1.5, 0, 0);
    setBoneEuler(vrm, 'rightLowerArm', -1.5, 0, 0);
    setBoneEuler(vrm, 'leftUpperLeg', -0.6, 0, 0);
    setBoneEuler(vrm, 'rightUpperLeg', -0.6, 0, 0);
  }

  // Wiggle chest and head to the beat
  setBoneEuler(vrm, 'spine', 0, Math.sin(t) * 0.5, Math.cos(t) * 0.2);
  setBoneEuler(vrm, 'chest', 0, Math.sin(t * 1.5) * 0.3, 0);
  setBoneEuler(vrm, 'neck', 0, -Math.sin(t) * 0.4, 0);
  
  // Wiggle lower legs independently
  setBoneEuler(vrm, 'leftLowerLeg', Math.abs(Math.sin(t)) * 0.8, 0, 0);
  setBoneEuler(vrm, 'rightLowerLeg', Math.abs(Math.cos(t)) * 0.8, 0, 0);
}

function applyEmotion(vrm, emotion) {
  const keys = ['happy', 'angry', 'sad', 'relaxed', 'surprised'];
  for (const key of keys) {
    setExpression(vrm, key, 0);
  }

  if (emotion === 'happy') {
    setExpression(vrm, 'happy', 0.65);
  } else if (emotion === 'listening') {
    setExpression(vrm, 'relaxed', 0.45);
  } else if (emotion === 'thinking') {
    setExpression(vrm, 'surprised', 0.25);
  }
}

const OUTFIT_KEYWORDS = ['top', 'dress', 'skirt', 'cloth', 'wear', 'jacket', 'shirt', 'acc'];
const SHOE_KEYWORDS = ['shoe', 'boot', 'heel'];
const SKIP_STYLE_KEYWORDS = ['face', 'skin', 'body', 'eye', 'mouth', 'hair'];

function materialToken(material, mesh) {
  return `${mesh?.name || ''} ${material?.name || ''}`.toLowerCase();
}

function hasKeyword(value, keywords) {
  return keywords.some((keyword) => value.includes(keyword));
}

function paintMaterial(material, { colorHex, emissiveHex, emissiveIntensity, roughness, metalness, envMapIntensity }) {
  if (!material?.color?.isColor) return;

  material.color.setHex(colorHex);

  if (material.emissive?.isColor && emissiveHex !== undefined) {
    material.emissive.setHex(emissiveHex);
  }

  if ('emissiveIntensity' in material && emissiveIntensity !== undefined) {
    material.emissiveIntensity = emissiveIntensity;
  }

  if ('roughness' in material && roughness !== undefined) {
    material.roughness = roughness;
  }

  if ('metalness' in material && metalness !== undefined) {
    material.metalness = metalness;
  }

  if ('envMapIntensity' in material && envMapIntensity !== undefined) {
    material.envMapIntensity = envMapIntensity;
  }

  material.needsUpdate = true;
}

function applyGlamOutfit(vrm) {
  const styledMaterials = new Set();

  vrm.scene.traverse((child) => {
    if (!child.isMesh) return;

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (!material || styledMaterials.has(material)) continue;
      styledMaterials.add(material);

      const token = materialToken(material, child);
      if (hasKeyword(token, SKIP_STYLE_KEYWORDS)) continue;

      if (hasKeyword(token, SHOE_KEYWORDS)) {
        paintMaterial(material, {
          colorHex: 0x120d10,
          emissiveHex: 0x1d1009,
          emissiveIntensity: 0.26,
          roughness: 0.34,
          metalness: 0.32,
          envMapIntensity: 0.46
        });
        continue;
      }

      if (token.includes('_cloth') || hasKeyword(token, OUTFIT_KEYWORDS)) {
        paintMaterial(material, {
          colorHex: 0x181116,
          emissiveHex: 0x26110b,
          emissiveIntensity: 0.32,
          roughness: 0.34,
          metalness: 0.28,
          envMapIntensity: 0.64
        });
      }
    }
  });
}

function createFallbackAvatar() {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.5, 1.2, 10, 20),
    new THREE.MeshStandardMaterial({ color: 0x4a1622, roughness: 0.45, metalness: 0.22 })
  );
  body.position.y = 0.5;

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 36, 36),
    new THREE.MeshStandardMaterial({ color: 0xf2cabf, roughness: 0.58, metalness: 0.0 })
  );
  head.position.y = 1.56;

  const waistAccent = new THREE.Mesh(
    new THREE.TorusGeometry(0.38, 0.05, 16, 40),
    new THREE.MeshStandardMaterial({ color: 0xe5a37f, roughness: 0.3, metalness: 0.55 })
  );
  waistAccent.rotation.x = Math.PI / 2;
  waistAccent.position.set(0, 0.42, 0);

  group.add(body);
  group.add(head);
  group.add(waistAccent);
  return group;
}

function fitAvatarToView(object3d, camera, floorY, cameraMode) {
  const box = new THREE.Box3().setFromObject(object3d);
  if (box.isEmpty()) return { focusY: 1.0, headY: 1.3 };

  const size = box.getSize(new THREE.Vector3());
  const height = Math.max(size.y, 0.001);

  const targetHeight = cameraMode === 'close' ? 1.92 : 1.72;
  const scale = targetHeight / height;
  object3d.scale.multiplyScalar(scale);
  object3d.updateMatrixWorld(true);

  const scaledBox = new THREE.Box3().setFromObject(object3d);
  const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
  const minY = scaledBox.min.y;

  object3d.position.x += -scaledCenter.x;
  object3d.position.z += -scaledCenter.z;
  object3d.position.y += floorY - minY;
  object3d.updateMatrixWorld(true);

  const finalBox = new THREE.Box3().setFromObject(object3d);
  const finalCenter = finalBox.getCenter(new THREE.Vector3());
  const finalSize = finalBox.getSize(new THREE.Vector3());

  let headY;
  let focusY;
  let verticalFit;
  let horizontalFit;
  let minDist;
  let maxDist;

  if (cameraMode === 'close') {
    headY = finalCenter.y + finalSize.y * 0.35;
    focusY = finalCenter.y + finalSize.y * 0.2;
    verticalFit = (finalSize.y * 0.26) / Math.tan((camera.fov * Math.PI) / 360);
    horizontalFit = (finalSize.x * 0.5) / Math.tan((camera.fov * Math.PI) / 360);
    minDist = 0.72;
    maxDist = 1.15;
  } else {
    headY = finalCenter.y + finalSize.y * 0.33;
    focusY = finalCenter.y + finalSize.y * 0.04;
    verticalFit = (finalSize.y * 0.68) / Math.tan((camera.fov * Math.PI) / 360);
    horizontalFit = (finalSize.x * 0.9) / Math.tan((camera.fov * Math.PI) / 360);
    minDist = 1.65;
    maxDist = 2.8;
  }

  const fitDist = THREE.MathUtils.clamp(Math.max(verticalFit, horizontalFit), minDist, maxDist);
  camera.position.set(0, focusY + 0.03, fitDist);
  camera.lookAt(0, headY, 0);
  return { focusY, headY };
}

function detectModelKind(modelUrl = '') {
  const cleanUrl = String(modelUrl || '').split('?')[0].toLowerCase();
  if (cleanUrl.endsWith('.vrm')) return 'vrm';
  if (cleanUrl.endsWith('.fbx')) return 'fbx';
  if (cleanUrl.endsWith('.glb') || cleanUrl.endsWith('.gltf')) return 'gltf';
  return 'vrm';
}

const GENERIC_SKIN_KEYWORDS = ['skin', 'face', 'body', 'head', 'neck', 'ear', 'arm', 'hand', 'leg'];
const GENERIC_HAIR_KEYWORDS = ['hair', 'brow', 'lash'];
const GENERIC_EYE_KEYWORDS = ['eye', 'iris', 'pupil'];
const GENERIC_LIP_KEYWORDS = ['lip', 'mouth'];
const GENERIC_OUTFIT_KEYWORDS = ['cloth', 'dress', 'top', 'shirt', 'skirt', 'pants', 'short', 'shoe', 'boot', 'heel', 'outfit', 'jacket'];

function genericMaterialToken(material, mesh) {
  return `${mesh?.name || ''} ${material?.name || ''}`.toLowerCase();
}

function isGenericSkinToken(token) {
  return (
    hasKeyword(token, GENERIC_SKIN_KEYWORDS) &&
    !hasKeyword(token, [...GENERIC_HAIR_KEYWORDS, ...GENERIC_EYE_KEYWORDS, ...GENERIC_OUTFIT_KEYWORDS])
  );
}

function blendGenericMaterial(material, { blendHex, blendMix = 0.35, emissiveHex, emissiveIntensity, roughness, metalness, envMapIntensity }) {
  if (material?.color?.isColor && blendHex !== undefined) {
    material.color.lerp(new THREE.Color(blendHex), blendMix);
  }

  if (material?.emissive?.isColor && emissiveHex !== undefined) {
    material.emissive.setHex(emissiveHex);
  }

  if ('emissiveIntensity' in material && emissiveIntensity !== undefined) {
    material.emissiveIntensity = emissiveIntensity;
  }

  if ('roughness' in material && roughness !== undefined) {
    material.roughness = roughness;
  }

  if ('metalness' in material && metalness !== undefined) {
    material.metalness = metalness;
  }

  if ('envMapIntensity' in material && envMapIntensity !== undefined) {
    material.envMapIntensity = envMapIntensity;
  }

  material.needsUpdate = true;
}

function prepareGenericAvatar(object3d) {
  const styledMaterials = new Set();

  object3d.traverse((child) => {
    if (!child.isMesh) return;

    child.castShadow = true;
    child.receiveShadow = true;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (!material || styledMaterials.has(material)) continue;
      styledMaterials.add(material);

      const token = genericMaterialToken(material, child);

      if (isGenericSkinToken(token)) {
        blendGenericMaterial(material, {
          blendHex: 0xf3d3c9,
          blendMix: 0.62,
          emissiveHex: 0x26110d,
          emissiveIntensity: 0.06,
          roughness: 0.54,
          metalness: 0.04,
          envMapIntensity: 0.62
        });
        continue;
      }

      if (hasKeyword(token, GENERIC_HAIR_KEYWORDS)) {
        blendGenericMaterial(material, {
          blendHex: 0x382127,
          blendMix: 0.55,
          emissiveHex: 0x16090c,
          emissiveIntensity: 0.05,
          roughness: 0.28,
          metalness: 0.18,
          envMapIntensity: 0.88
        });
        continue;
      }

      if (hasKeyword(token, GENERIC_EYE_KEYWORDS)) {
        blendGenericMaterial(material, {
          blendHex: 0xf4d8e4,
          blendMix: 0.28,
          emissiveHex: 0x1a1115,
          emissiveIntensity: 0.08,
          roughness: 0.16,
          metalness: 0.02,
          envMapIntensity: 0.76
        });
        continue;
      }

      if (hasKeyword(token, GENERIC_LIP_KEYWORDS)) {
        blendGenericMaterial(material, {
          blendHex: 0xcf7288,
          blendMix: 0.45,
          emissiveHex: 0x2a0c13,
          emissiveIntensity: 0.08,
          roughness: 0.3,
          metalness: 0.02,
          envMapIntensity: 0.64
        });
        continue;
      }

      if (hasKeyword(token, GENERIC_OUTFIT_KEYWORDS)) {
        blendGenericMaterial(material, {
          blendHex: 0x26161d,
          blendMix: 0.4,
          emissiveHex: 0x1d0d12,
          emissiveIntensity: 0.12,
          roughness: 0.36,
          metalness: 0.22,
          envMapIntensity: 0.68
        });
        continue;
      }

      if ('envMapIntensity' in material && material.envMapIntensity < 0.5) {
        material.envMapIntensity = 0.5;
      }
      material.needsUpdate = true;
    }
  });
}

function disposeObject3D(object3d) {
  const disposedMaterials = new Set();

  object3d.traverse((child) => {
    if (!child.isMesh) return;

    child.geometry?.dispose?.();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (!material || disposedMaterials.has(material)) continue;
      disposedMaterials.add(material);
      material.dispose?.();
    }
  });
}

export default function VRMStage({
  isSpeaking,
  isDancing = false,
  mouthOpen = 0,
  emotion = 'neutral',
  cameraMode = 'full',
  modelUrl = '/models/anime.vrm'
}) {
  const mountRef = useRef(null);
  const speakingRef = useRef(isSpeaking);
  const dancingRef = useRef(isDancing);
  const mouthRef = useRef(mouthOpen);
  const emotionRef = useRef(emotion);

  useEffect(() => {
    speakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    dancingRef.current = isDancing;
  }, [isDancing]);

  useEffect(() => {
    mouthRef.current = mouthOpen;
  }, [mouthOpen]);

  useEffect(() => {
    emotionRef.current = emotion;
  }, [emotion]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    // Let background be transparent to show the animated CSS grid
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(cameraMode === 'close' ? 27 : 30, 1, 0.1, 100);
    camera.position.set(0, cameraMode === 'close' ? 1.2 : 0.9, cameraMode === 'close' ? 1.0 : 2.2);
    camera.lookAt(0, 0.95, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    mount.appendChild(renderer.domElement);

    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.11, 0.5, 0.62);
    composer.addPass(renderPass);
    composer.addPass(bloomPass);

    const hemi = new THREE.HemisphereLight(0xf9f2ff, 0xaea2a6, 0.62);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff0e4, 1.08);
    keyLight.position.set(2.1, 3.0, 2.0);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xff9ac5, 0.36);
    rimLight.position.set(-2.3, 2.1, -2.1);
    scene.add(rimLight);

    const fill = new THREE.PointLight(0xfff1ea, 0.18, 7.4);
    fill.position.set(0.2, 1.45, 1.45);
    scene.add(fill);

    const accent = new THREE.PointLight(0xff5f9f, 0.24, 5.6);
    accent.position.set(-1.4, 1.7, 1.1);
    scene.add(accent);

    const floorY = -1.02;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ color: 0xc7ccd7, roughness: 1.0, metalness: 0.0, visible: false })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = floorY;
    scene.add(floor);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.0, 64),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16 })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = floorY + 0.01;
    scene.add(shadow);

    const particleCount = 420;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i += 1) {
      particlePositions[i * 3 + 0] = (Math.random() - 0.5) * 14;
      particlePositions[i * 3 + 1] = Math.random() * 8 - 0.6;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 10 - 2;
    }
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({ color: 0xffdcf7, size: 0.04, transparent: true, opacity: 0.45, sizeAttenuation: true })
    );
    scene.add(particles);

    const fallback = createFallbackAvatar();
    fallback.position.y = floorY + 0.65;
    fallback.scale.setScalar(1.35);
    scene.add(fallback);

    let vrm = null;
    let avatarRoot = null;
    let modelKind = detectModelKind(modelUrl);
    let avatarBaseY = 0;
    let avatarBaseRotY = Math.PI;
    let cameraFocusY = 1.1;
    let cameraHeadY = 1.35;
    let destroyed = false;

    const handleAvatarReady = (object3d, kind) => {
      if (destroyed) return;

      modelKind = kind;
      avatarRoot = object3d;
      object3d.position.set(0, 0, 0);
      object3d.scale.setScalar(1.0);
      object3d.rotation.y = kind === 'vrm' ? Math.PI : 0;

      const fit = fitAvatarToView(object3d, camera, floorY, cameraMode);
      cameraFocusY = kind === 'vrm' ? fit.focusY - 0.62 : fit.focusY;
      cameraHeadY = kind === 'vrm' ? fit.headY - 0.62 : fit.headY;

      if (kind === 'vrm' && vrm) {
        applyIdlePose(vrm);
        object3d.position.y -= 0.62;
      } else {
        prepareGenericAvatar(object3d);
        renderer.toneMappingExposure = 1.06;
        keyLight.intensity = 1.16;
        fill.intensity = 0.26;
        accent.intensity = 0.32;
        bloomPass.strength = 0.14;
      }

      avatarBaseY = object3d.position.y;
      avatarBaseRotY = object3d.rotation.y;

      const avatarBox = new THREE.Box3().setFromObject(object3d);
      const avatarSize = avatarBox.getSize(new THREE.Vector3());
      shadow.scale.setScalar(Math.max(0.9, avatarSize.x * 0.58));

      scene.add(object3d);
      fallback.visible = false;
    };

    const handleLoadError = () => {
      avatarRoot = null;
      vrm = null;
      fallback.visible = true;
    };

    if (modelKind === 'fbx') {
      const loader = new FBXLoader();
      loader.load(
        modelUrl,
        (object3d) => {
          if (destroyed) return;
          handleAvatarReady(object3d, 'fbx');
        },
        undefined,
        handleLoadError
      );
    } else {
      const loader = new GLTFLoader();
      loader.crossOrigin = 'anonymous';
      if (modelKind === 'vrm') {
        loader.register((parser) => new VRMLoaderPlugin(parser));
      }

      loader.load(
        modelUrl,
        (gltf) => {
          if (destroyed) return;

          if (modelKind === 'vrm') {
            vrm = gltf.userData.vrm;
            if (!vrm) {
              handleLoadError();
              return;
            }

            VRMUtils.removeUnnecessaryVertices(gltf.scene);
            VRMUtils.combineSkeletons(gltf.scene);
            applyGlamOutfit(vrm);
            handleAvatarReady(vrm.scene, 'vrm');
            return;
          }

          handleAvatarReady(gltf.scene, 'gltf');
        },
        undefined,
        handleLoadError
      );
    }

    const clock = new THREE.Clock();
    let blink = 0;
    let nextBlinkTime = 1 + Math.random() * 3;

    const onResize = () => {
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
      bloomPass.setSize(w, h);
      camera.lookAt(0, cameraHeadY, 0);
    };

    onResize();
    window.addEventListener('resize', onResize);

    const loop = () => {
      if (destroyed) return;

      const delta = clock.getDelta();
      const elapsed = clock.elapsedTime;
      particles.rotation.y = elapsed * 0.03;

      if (vrm) {
        vrm.update(delta);
        
        if (dancingRef.current) {
          applyDancePose(vrm, elapsed);
          
          // Move drastically around the screen!
          const movePhase = elapsed * 2.2;
          // Walk/slide left and right heavily
          const targetX = Math.sin(movePhase) * 1.2; 
          // Move forward and back
          const targetZ = Math.cos(movePhase * 0.8) * 1.5; 
          // Big high jump on the beat
          const targetY = avatarBaseY + Math.abs(Math.sin(elapsed * 5.0)) * 0.4;
          // Spin her completely around left and right
          const targetRot = avatarBaseRotY + Math.sin(elapsed * 1.5) * Math.PI;

          vrm.scene.position.x = THREE.MathUtils.lerp(vrm.scene.position.x, targetX, 0.15);
          vrm.scene.position.z = THREE.MathUtils.lerp(vrm.scene.position.z, targetZ, 0.15);
          vrm.scene.position.y = THREE.MathUtils.lerp(vrm.scene.position.y, targetY, 0.4);
          vrm.scene.rotation.y = THREE.MathUtils.lerp(vrm.scene.rotation.y, targetRot, 0.2);

        } else {
          applyIdlePose(vrm);
          const idleSway = Math.sin(elapsed * 0.6) * 0.02;
          const idleBob = Math.sin(elapsed * 1.1) * 0.004;
          
          // Smoothly return to center & rotation when dance ends
          vrm.scene.rotation.y = THREE.MathUtils.lerp(vrm.scene.rotation.y, avatarBaseRotY + idleSway, 0.05);
          vrm.scene.position.y = THREE.MathUtils.lerp(vrm.scene.position.y, avatarBaseY + idleBob, 0.05);
          vrm.scene.position.x = THREE.MathUtils.lerp(vrm.scene.position.x, 0, 0.05);
          vrm.scene.position.z = THREE.MathUtils.lerp(vrm.scene.position.z, 0, 0.05);
        }

        // The greeting wave shouldn't override dance
        if (elapsed < 2.5 && !dancingRef.current) {
          const wavePhase = (elapsed * 12) % (Math.PI * 2);
          const waveAngle = Math.sin(wavePhase) * 0.35;
          setBoneEuler(vrm, 'rightUpperArm', 0.0, 0.0, -2.4); // arm up
          setBoneEuler(vrm, 'rightLowerArm', 0.0, 0.0, -0.6 + waveAngle); // waving forearm
          setBoneEuler(vrm, 'rightHand', 0.0, 0.0, 0.0);
        }

        applyEmotion(vrm, emotionRef.current);

        const targetMouth = Math.max(0, Math.min(1, mouthRef.current));
        setExpression(vrm, 'aa', targetMouth);

        if (elapsed > nextBlinkTime) {
          blink = 1;
          nextBlinkTime = elapsed + 2 + Math.random() * 3;
        }
        blink = THREE.MathUtils.lerp(blink, 0, 0.28);
        setExpression(vrm, 'blink', blink);
        
        // Magical particles floating up
        const positions = particles.geometry.attributes.position.array;
        for (let i = 0; i < particleCount; i++) {
           positions[i * 3 + 1] += 0.005; // drift up
           if (positions[i * 3 + 1] > 6) positions[i * 3 + 1] = -0.6; // reset at bottom
        }
        particles.geometry.attributes.position.needsUpdate = true;
        
        // Dynamic camera panning effect over the scene
        const camOffset = Math.sin(elapsed * 0.3) * 0.05;
        camera.position.x = THREE.MathUtils.lerp(camera.position.x, camOffset, 0.05);

        camera.position.y = THREE.MathUtils.lerp(camera.position.y, cameraFocusY + 0.03, 0.08);
        camera.lookAt(0, cameraHeadY, 0);
      } else if (avatarRoot) {
        const camOffset = Math.sin(elapsed * 0.3) * 0.05;

        if (dancingRef.current) {
          const movePhase = elapsed * 1.6;
          avatarRoot.position.x = THREE.MathUtils.lerp(avatarRoot.position.x, Math.sin(movePhase) * 0.5, 0.08);
          avatarRoot.position.z = THREE.MathUtils.lerp(avatarRoot.position.z, Math.cos(movePhase * 0.75) * 0.35, 0.08);
          avatarRoot.position.y = THREE.MathUtils.lerp(avatarRoot.position.y, avatarBaseY + Math.abs(Math.sin(elapsed * 4.2)) * 0.08, 0.12);
          avatarRoot.rotation.y = THREE.MathUtils.lerp(
            avatarRoot.rotation.y,
            avatarBaseRotY + Math.sin(elapsed * 1.2) * 0.35,
            0.08
          );
        } else {
          const idleSway = Math.sin(elapsed * 0.7) * 0.03;
          const idleBob = Math.sin(elapsed * 1.15) * 0.012;
          avatarRoot.rotation.y = THREE.MathUtils.lerp(avatarRoot.rotation.y, avatarBaseRotY + idleSway, 0.05);
          avatarRoot.position.y = THREE.MathUtils.lerp(avatarRoot.position.y, avatarBaseY + idleBob, 0.05);
          avatarRoot.position.x = THREE.MathUtils.lerp(avatarRoot.position.x, 0, 0.05);
          avatarRoot.position.z = THREE.MathUtils.lerp(avatarRoot.position.z, 0, 0.05);
        }

        camera.position.x = THREE.MathUtils.lerp(camera.position.x, camOffset, 0.05);
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, cameraFocusY + 0.03, 0.08);
        camera.lookAt(0, cameraHeadY, 0);
      } else {
        fallback.rotation.y = Math.sin(elapsed * 0.85) * 0.18;
        fallback.position.y = floorY + 0.65 + Math.sin(elapsed * 1.3) * 0.02;
        camera.position.set(0, cameraMode === 'close' ? 1.12 : 0.95, cameraMode === 'close' ? 1.0 : 2.15);
        camera.lookAt(0, cameraMode === 'close' ? 1.05 : 0.95, 0);
      }

      composer.render();
      requestAnimationFrame(loop);
    };

    loop();

    return () => {
      destroyed = true;
      window.removeEventListener('resize', onResize);
      if (vrm) {
        VRMUtils.deepDispose(vrm.scene);
        scene.remove(vrm.scene);
      } else if (avatarRoot) {
        disposeObject3D(avatarRoot);
        scene.remove(avatarRoot);
      }

      particleGeometry.dispose();
      particles.material.dispose();
      floor.geometry.dispose();
      floor.material.dispose();
      shadow.geometry.dispose();
      shadow.material.dispose();

      scene.clear();
      composer.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [modelUrl, cameraMode]);

  return <div ref={mountRef} className="fixed inset-0 w-screen h-[100dvh]" />;
}
