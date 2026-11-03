import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  Zap,
  Swords,
  Flame,
  Volume2,
  VolumeX,
  Sparkles,
  Activity,
  Award,
  Info,
  Play,
} from 'lucide-react';

type ThreeSceneState = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  argusGroup: THREE.Group;
  bladeMat: THREE.MeshStandardMaterial;
  bladeLight: THREE.PointLight;
  ultLight: THREE.PointLight;
  wingsGroup: THREE.Group;
  runeRing: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  particles: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  particleVel: Array<{ y: number; angle: number; speed: number }>;
  mousePos: { x: number; y: number };
};

// --- MAIN REACT APP ---
export default function App() {
  const [ultimateActive, setUltimateActive] = useState(false);
  const [activeSkill, setActiveSkill] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showLoreModal, setShowLoreModal] = useState(false);

  // Ref for Three.js integration
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const threeStateRef = useRef<ThreeSceneState | null>(null);

  // Skill Data
  const skills = [
    {
      id: 'passive',
      name: 'Warmonger',
      type: 'Passive',
      cd: 'N/A',
      mana: '0',
      icon: '⚔️',
      description: 'When Argus takes or deals damage, his Demonic Blade charges. When fully charged, his next basic attack strikes twice, dealing immense Physical Damage and pulling him toward the target.',
      details: 'Demonic Blade Charge Rate increases as Argus loses HP.'
    },
    {
      id: 'skill1',
      name: 'Demonic Grip',
      type: 'Mobility / CC',
      cd: '12.0s',
      mana: '60',
      icon: '⛓️',
      description: 'Argus projects a demonic hand in a specified direction, dealing Physical Damage to the first enemy hit and pulling both of them towards each other. Can be recast to slash forward.',
      details: 'Stuns the target for 0.7s on hit. Second phase provides extra mobility.'
    },
    {
      id: 'skill2',
      name: 'Meteoric Sword',
      type: 'Damage / Slow',
      cd: '10.0s',
      mana: '75',
      icon: '🗡️',
      description: 'After a short delay, Argus thrusts his Demonic Blade forward, dealing heavy damage and cursing the enemy. Cursed enemies leave a Curse Trail that grants Argus bonus movement speed.',
      details: 'Applies a 80% slow for 1s. Enemies moving while cursed take continuous bleed damage.'
    },
    {
      id: 'ultimate',
      name: 'Eternal Evil',
      type: 'Buff / Invulnerability',
      cd: '60.0s',
      mana: '0',
      icon: '🔥',
      description: 'Argus transforms into a Fallen Angel, becoming completely immune to death for 4 seconds. 100% of the damage dealt during this duration is converted into HP after the effect ends.',
      details: 'Passively increases Attack Power and removes all debuffs upon activation.'
    }
  ];

  // Stats Data
  const stats = [
    { label: 'Durability', value: 85, color: 'from-amber-500 to-red-600' },
    { label: 'Offense', value: 92, color: 'from-red-600 to-crimson-600' },
    { label: 'Control Effect', value: 65, color: 'from-purple-600 to-indigo-600' },
    { label: 'Difficulty', value: 60, color: 'from-blue-600 to-cyan-500' }
  ];

  // Sound generator using Web Audio API (No external sound files required)
  const playSoundEffect = (type: 'ult' | 'click') => {
    if (!soundEnabled) return;
    try {
      const AudioContextCtor =
        window.AudioContext ||
        (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (!AudioContextCtor) {
        return;
      }

      const audioCtx = new AudioContextCtor();
      if (type === 'ult') {
        // Deep demonic burst sound
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 1.2);

        gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.2);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 1.2);
      } else if (type === 'click') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
      }
    } catch {
      console.log('Audio API not supported or blocked');
    }
  };

  // Toggle Ultimate Mode
  const toggleUltimate = () => {
    const newState = !ultimateActive;
    setUltimateActive(newState);
    playSoundEffect(newState ? 'ult' : 'click');
  };

  // --- THREE.JS SCENE CREATION & RENDER LOOP ---
  useEffect(() => {
    if (!canvasRef.current) return;

    // 1. Scene Setup
    const container = canvasRef.current;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x060309, 0.035);

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 2.2, 8);

    // 3. Renderer Setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    // Clear element
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. Lighting System
    const ambientLight = new THREE.AmbientLight(0x2a1024, 1.2);
    scene.add(ambientLight);

    // Main Rim Light (Crimson Backlight)
    const rimLight = new THREE.DirectionalLight(0xff1a3c, 3.5);
    rimLight.position.set(-5, 6, -4);
    scene.add(rimLight);

    // Key Light (Gold / Dark Silver Front)
    const keyLight = new THREE.DirectionalLight(0x90a0d0, 2.0);
    keyLight.position.set(4, 5, 5);
    keyLight.castShadow = true;
    scene.add(keyLight);

    // Sword Glowing Point Light
    const bladeLight = new THREE.PointLight(0xff0044, 4, 6);
    bladeLight.position.set(1.5, 2, 0.5);
    scene.add(bladeLight);

    // Ultimate Ground Light
    const ultLight = new THREE.PointLight(0xff0033, 0, 10);
    ultLight.position.set(0, 0.2, 0);
    scene.add(ultLight);

    // 5. Build Argus 3D Hero Mesh (Custom Algorithmic Character Model)
    const argusGroup = new THREE.Group();
    scene.add(argusGroup);

    // Materials
    const darkArmorMat = new THREE.MeshStandardMaterial({
      color: 0x111116,
      roughness: 0.35,
      metalness: 0.85,
    });

    const goldTrimMat = new THREE.MeshStandardMaterial({
      color: 0xb8860b,
      roughness: 0.4,
      metalness: 0.9,
    });

    const crimsonGlowMat = new THREE.MeshBasicMaterial({
      color: 0xff0044,
    });

    // A. Torso & Chest Armor
    const torsoGeo = new THREE.CylinderGeometry(0.55, 0.35, 1.3, 8);
    const torso = new THREE.Mesh(torsoGeo, darkArmorMat);
    torso.position.y = 2.1;
    torso.castShadow = true;
    argusGroup.add(torso);

    // Chest Plate Core (Glowing Rune)
    const chestCoreGeo = new THREE.OctahedronGeometry(0.2, 0);
    const chestCore = new THREE.Mesh(chestCoreGeo, crimsonGlowMat);
    chestCore.position.set(0, 2.3, 0.35);
    chestCore.scale.set(1, 1.4, 0.5);
    argusGroup.add(chestCore);

    // Shoulder Pauldrons (Spiked)
    const createPauldron = (isLeft: boolean) => {
      const pGroup = new THREE.Group();
      const baseGeo = new THREE.ConeGeometry(0.4, 0.7, 5);
      const pMesh = new THREE.Mesh(baseGeo, darkArmorMat);
      pMesh.rotation.z = isLeft ? 1.2 : -1.2;
      pMesh.rotation.x = 0.2;
      pGroup.add(pMesh);

      // Spike ornament
      const spikeGeo = new THREE.ConeGeometry(0.12, 0.6, 4);
      const spike = new THREE.Mesh(spikeGeo, goldTrimMat);
      spike.position.set(isLeft ? -0.2 : 0.2, 0.2, 0);
      spike.rotation.z = isLeft ? 0.8 : -0.8;
      pGroup.add(spike);

      pGroup.position.set(isLeft ? -0.75 : 0.75, 2.6, 0);
      return pGroup;
    };
    argusGroup.add(createPauldron(true));
    argusGroup.add(createPauldron(false));

    // B. Helmet / Head (Fallen Angel Horned Mask)
    const headGroup = new THREE.Group();
    headGroup.position.y = 2.95;

    const helmGeo = new THREE.SphereGeometry(0.32, 12, 12);
    const helmet = new THREE.Mesh(helmGeo, darkArmorMat);
    headGroup.add(helmet);

    // Glowing Eyes Visor
    const eyeGeo = new THREE.BoxGeometry(0.35, 0.06, 0.15);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
    const eyes = new THREE.Mesh(eyeGeo, eyeMat);
    eyes.position.set(0, 0.03, 0.26);
    headGroup.add(eyes);

    // Horns
    const createHorn = (isLeft: boolean) => {
      const hornGeo = new THREE.ConeGeometry(0.08, 0.9, 5);
      const horn = new THREE.Mesh(hornGeo, darkArmorMat);
      horn.position.set(isLeft ? -0.25 : 0.25, 0.35, -0.05);
      horn.rotation.z = isLeft ? -0.5 : 0.5;
      horn.rotation.x = -0.3;
      return horn;
    };
    headGroup.add(createHorn(true));
    headGroup.add(createHorn(false));
    argusGroup.add(headGroup);

    // C. Limbs (Arms & Legs)
    // Left Arm (Shielding/Holding Grip)
    const armGeo = new THREE.CylinderGeometry(0.15, 0.12, 1.1, 8);
    const leftArm = new THREE.Mesh(armGeo, darkArmorMat);
    leftArm.position.set(-0.7, 2.0, 0.1);
    leftArm.rotation.z = 0.2;
    leftArm.rotation.x = 0.3;
    argusGroup.add(leftArm);

    // Right Arm (Holding Demonic Sword)
    const rightArm = new THREE.Mesh(armGeo, darkArmorMat);
    rightArm.position.set(0.7, 2.0, 0.2);
    rightArm.rotation.z = -0.4;
    rightArm.rotation.x = -0.6;
    argusGroup.add(rightArm);

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.18, 0.12, 1.4, 8);
    const leftLeg = new THREE.Mesh(legGeo, darkArmorMat);
    leftLeg.position.set(-0.3, 0.9, 0);
    leftLeg.rotation.z = -0.08;
    argusGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, darkArmorMat);
    rightLeg.position.set(0.3, 0.9, 0.1);
    rightLeg.rotation.z = 0.08;
    rightLeg.rotation.x = -0.15;
    argusGroup.add(rightLeg);

    // D. Demonic Blade (Argus Signature Weapon)
    const swordGroup = new THREE.Group();
    
    // Blade Hilt & Guard
    const hiltGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8);
    const hilt = new THREE.Mesh(hiltGeo, goldTrimMat);
    hilt.position.y = -0.3;
    swordGroup.add(hilt);

    const guardGeo = new THREE.BoxGeometry(0.6, 0.1, 0.15);
    const guard = new THREE.Mesh(guardGeo, darkArmorMat);
    swordGroup.add(guard);

    // Main Blade Mesh (Demonic Curved Edges)
    const bladeGeo = new THREE.ConeGeometry(0.16, 2.6, 4);
    bladeGeo.scale(1, 1, 0.2);
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0x22050b,
      metalness: 0.95,
      roughness: 0.1,
      emissive: 0x660011,
      emissiveIntensity: 0.8
    });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.y = 1.3;
    swordGroup.add(blade);

    // Blade Crimson Core Edge (Glowing inner vein)
    const veinGeo = new THREE.BoxGeometry(0.04, 2.2, 0.05);
    const vein = new THREE.Mesh(veinGeo, crimsonGlowMat);
    vein.position.y = 1.2;
    swordGroup.add(vein);

    // Position sword in right hand
    swordGroup.position.set(0.95, 1.8, 0.6);
    swordGroup.rotation.x = 0.5;
    swordGroup.rotation.z = -0.3;
    swordGroup.rotation.y = -0.2;
    argusGroup.add(swordGroup);

    // E. Majestic Demonic Wings System (6 Wings - 3 Per Side)
    const wingsGroup = new THREE.Group();
    wingsGroup.position.set(0, 2.3, -0.25);

    const wingFeatherMat = new THREE.MeshStandardMaterial({
      color: 0x0a050d,
      roughness: 0.5,
      metalness: 0.7,
      side: THREE.DoubleSide
    });

    const createWingTier = (angleOffset: number, scale: number, isLeft: boolean) => {
      const wingRoot = new THREE.Group();

      // Wing Arm Bone
      const boneGeo = new THREE.CylinderGeometry(0.04, 0.02, 1.8);
      const bone = new THREE.Mesh(boneGeo, darkArmorMat);
      bone.position.y = 0.9;
      bone.rotation.z = isLeft ? -0.8 : 0.8;
      wingRoot.add(bone);

      // Feather Feathers Layout
      for (let i = 0; i < 5; i++) {
        const featherShape = new THREE.ConeGeometry(0.15, 1.2 - i * 0.15, 3);
        featherShape.scale(1, 1, 0.1);
        const feather = new THREE.Mesh(featherShape, wingFeatherMat);
        feather.position.set(
          isLeft ? -0.4 - i * 0.2 : 0.4 + i * 0.2,
          1.2 - i * 0.22,
          -i * 0.05
        );
        feather.rotation.z = isLeft ? -1.0 - i * 0.15 : 1.0 + i * 0.15;
        wingRoot.add(feather);
      }

      wingRoot.scale.set(scale, scale, scale);
      wingRoot.rotation.z = angleOffset;
      return wingRoot;
    };

    // Wings pairs array for animation
    const wingPairs = [
      { left: createWingTier(-0.2, 1.3, true), right: createWingTier(0.2, 1.3, false) },
      { left: createWingTier(-0.6, 1.0, true), right: createWingTier(0.6, 1.0, false) },
      { left: createWingTier(-1.0, 0.7, true), right: createWingTier(1.0, 0.7, false) },
    ];

    wingPairs.forEach(pair => {
      wingsGroup.add(pair.left);
      wingsGroup.add(pair.right);
    });

    argusGroup.add(wingsGroup);

    // 6. Pedestal / Altar Platform
    const platformGroup = new THREE.Group();
    const pedestalGeo = new THREE.CylinderGeometry(2.6, 3.2, 0.4, 16);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x120e18,
      roughness: 0.8,
      metalness: 0.3
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = -0.2;
    pedestal.receiveShadow = true;
    platformGroup.add(pedestal);

    // Rune Circle Ring (Glowing Base)
    const ringGeo = new THREE.RingGeometry(2.0, 2.3, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff0044,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6
    });
    const runeRing = new THREE.Mesh(ringGeo, ringMat);
    runeRing.rotation.x = Math.PI / 2;
    runeRing.position.y = 0.01;
    platformGroup.add(runeRing);

    scene.add(platformGroup);

    // 7. Dark Energy Particle Swarm System
    const particleCount = 250;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);
    const particleVel: Array<{ y: number; angle: number; speed: number }> = [];

    for (let i = 0; i < particleCount; i++) {
      particlePos[i * 3] = (Math.random() - 0.5) * 8;
      particlePos[i * 3 + 1] = Math.random() * 5;
      particlePos[i * 3 + 2] = (Math.random() - 0.5) * 8;
      
      particleVel.push({
        y: 0.008 + Math.random() * 0.015,
        angle: Math.random() * Math.PI * 2,
        speed: 0.005 + Math.random() * 0.01
      });
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));

    const particleMat = new THREE.PointsMaterial({
      color: 0xff1a4d,
      size: 0.07,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // Store references in Ref for React state interactions
    threeStateRef.current = {
      scene,
      camera,
      renderer,
      argusGroup,
      bladeMat,
      bladeLight,
      ultLight,
      wingsGroup,
      runeRing,
      particles,
      particleVel,
      mousePos: { x: 0, y: 0 }
    };

    // 8. Mouse Interaction (Parallax Tilt & Orbit Drag)
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const handleMouseDown = () => {
      isDragging = true;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / container.clientWidth) * 2 - 1;
      const y = -((e.clientY - rect.top) / container.clientHeight) * 2 + 1;

      if (threeStateRef.current) {
        threeStateRef.current.mousePos = { x, y };
      }

      if (isDragging) {
        const deltaX = e.clientX - previousMousePosition.x;
        argusGroup.rotation.y += deltaX * 0.008;
      }
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    const domElement = container;
    domElement.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('resize', handleResize);

    // 9. Main Animation Loop
    const clock = new THREE.Clock();
    let animId = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      const state = threeStateRef.current;
      if (!state) return;

      // Subtle breathing / floating animation for Argus
      const floatOffsetY = Math.sin(elapsedTime * 1.8) * 0.08;
      state.argusGroup.position.y = floatOffsetY;

      // Wing flapping physics
      const wingFlap = Math.sin(elapsedTime * 2.2) * 0.12;
      state.wingsGroup.children.forEach((wing, idx) => {
        const factor = idx % 2 === 0 ? 1 : -1;
        wing.rotation.y = factor * wingFlap;
      });

      // Sword pulsing aura glow animation
      state.bladeMat.emissiveIntensity = 0.6 + Math.sin(elapsedTime * 4) * 0.4;
      state.bladeLight.intensity = 3 + Math.sin(elapsedTime * 6) * 1.5;

      // Particle physics update loop
      const positions = state.particles.geometry.attributes.position.array;
      for (let i = 0; i < particleCount; i++) {
        positions[i * 3 + 1] += state.particleVel[i].y;
        positions[i * 3] += Math.cos(elapsedTime + i) * 0.003;
        
        // Reset particles that float up high
        if (positions[i * 3 + 1] > 5) {
          positions[i * 3 + 1] = 0;
          positions[i * 3] = (Math.random() - 0.5) * 6;
          positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
        }
      }
      state.particles.geometry.attributes.position.needsUpdate = true;

      // Gentle mouse parallax effect on camera
      if (!isDragging) {
        state.camera.position.x += (state.mousePos.x * 0.8 - state.camera.position.x) * 0.03;
        state.camera.position.y += (2.2 + state.mousePos.y * 0.5 - state.camera.position.y) * 0.03;
        state.camera.lookAt(0, 2.0, 0);
      }

      // Ground Rune Ring Rotation
      state.runeRing.rotation.z = elapsedTime * 0.2;

      // Render Scene
      state.renderer.render(state.scene, state.camera);
    };

    animate();

    // Clean up Three.js scene on unmount
    return () => {
      cancelAnimationFrame(animId);
      domElement.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('resize', handleResize);
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update Three.js scene when Ultimate mode toggles
  useEffect(() => {
    const state = threeStateRef.current;
    if (!state) return;

    if (ultimateActive) {
      // Enhanced Demonic Wings Expansion & Red Flaming Aura
      state.wingsGroup.scale.set(1.45, 1.45, 1.45);
      state.bladeMat.emissive.setHex(0xff0022);
      state.bladeMat.emissiveIntensity = 2.5;
      state.ultLight.intensity = 8.0;
      state.runeRing.material.color.setHex(0xff0000);
      state.runeRing.material.opacity = 0.95;
      state.particles.material.color.setHex(0xff0033);
      state.particles.material.size = 0.12;

      // Slight scale pulse on Argus
      state.argusGroup.scale.set(1.1, 1.1, 1.1);
    } else {
      // Normal State Reset
      state.wingsGroup.scale.set(1.0, 1.0, 1.0);
      state.bladeMat.emissive.setHex(0x660011);
      state.bladeMat.emissiveIntensity = 0.8;
      state.ultLight.intensity = 0.0;
      state.runeRing.material.color.setHex(0xff0044);
      state.runeRing.material.opacity = 0.6;
      state.particles.material.color.setHex(0xff1a4d);
      state.particles.material.size = 0.07;

      state.argusGroup.scale.set(1.0, 1.0, 1.0);
    }
  }, [ultimateActive]);

  return (
    <div className={`relative w-full min-h-screen bg-slate-950 text-slate-100 font-sans overflow-x-hidden selection:bg-red-900 selection:text-red-100 transition-colors duration-700 ${ultimateActive ? 'shadow-[inset_0_0_100px_rgba(239,68,68,0.25)]' : ''}`}>
      
      {/* Dynamic Background Glowing FX Layer */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className={`absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full blur-[140px] transition-all duration-1000 ${ultimateActive ? 'bg-red-600/30 scale-125' : 'bg-red-950/20'}`}></div>
        <div className={`absolute bottom-0 right-1/4 w-[600px] h-[600px] rounded-full blur-[160px] transition-all duration-1000 ${ultimateActive ? 'bg-purple-700/25' : 'bg-purple-950/15'}`}></div>
        {/* Subtle grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f19290a_1px,transparent_1px),linear-gradient(to_bottom,#1f19290a_1px,transparent_1px)] bg-[size:3rem_3rem]"></div>
      </div>

      {/* THREE.JS CANVAS CONTAINER */}
      <div 
        ref={canvasRef} 
        className="fixed inset-0 w-full h-full z-0 cursor-grab active:cursor-grabbing"
        title="Click and drag to rotate Argus 3D Model"
      />

      {/* TOP NAVIGATION BAR */}
      <header className="relative z-20 flex items-center justify-between px-6 lg:px-12 py-5 backdrop-blur-md bg-slate-950/40 border-b border-red-900/20">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-purple-900 p-[1px] shadow-lg shadow-red-900/40">
            <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center">
              <Swords className="w-5 h-5 text-red-500 animate-pulse" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-wider bg-gradient-to-r from-red-500 via-purple-300 to-slate-100 bg-clip-text text-transparent">
              MOBILE LEGENDS
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-red-400/80 font-bold">Hero Showcase</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-4">
          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white hover:border-red-900/50 transition"
            title="Toggle Web Audio SFX"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-red-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            <span className="text-xs font-medium hidden sm:inline">{soundEnabled ? 'SFX ON' : 'SFX OFF'}</span>
          </button>

          {/* Lore Info Button */}
          <button 
            onClick={() => setShowLoreModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-red-900/40 to-purple-900/40 border border-red-700/40 text-red-200 hover:bg-red-900/60 transition text-xs font-semibold uppercase tracking-wider"
          >
            <Info className="w-4 h-4 text-red-400" />
            Hero Lore
          </button>
        </div>
      </header>

      {/* MAIN HERO LANDING CONTENT GRID */}
      <main className="relative z-10 grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-80px)] pointer-events-none">
        
        {/* LEFT COLUMN: HERO TITLES & STATS OVERLAY */}
        <div className="lg:col-span-5 flex flex-col justify-between p-6 lg:p-12 pointer-events-auto">
          
          <div className="space-y-6 mt-4">
            {/* Class Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-950/80 border border-red-600/40 text-red-400 text-xs font-bold uppercase tracking-widest backdrop-blur-md shadow-lg shadow-red-950/50">
              <Sparkles className="w-3.5 h-3.5 text-red-500" />
              Fallen Angel • Fighter
            </div>

            {/* Main Name */}
            <div>
              <h2 className="text-5xl lg:text-7xl font-black tracking-tight text-white uppercase drop-shadow-[0_4px_20px_rgba(220,38,38,0.5)]">
                ARGUS
              </h2>
              <p className="text-lg lg:text-xl font-medium text-red-400/90 mt-1 tracking-wide">
                The Nightmarish Angel of Death
              </p>
            </div>

            {/* Quote / Subtitle */}
            <blockquote className="border-l-2 border-red-600/80 pl-4 py-1 text-slate-300 text-sm italic bg-slate-900/30 rounded-r-lg">
              "Eternity is a curse. Let my blade decide your fate in the Land of Dawn."
            </blockquote>

            {/* Interactive Ultimate Toggle Button */}
            <div className="pt-2">
              <button
                onClick={toggleUltimate}
                className={`relative group w-full sm:w-auto px-8 py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all duration-300 transform active:scale-95 shadow-2xl overflow-hidden ${
                  ultimateActive
                    ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white shadow-red-600/60 ring-4 ring-red-500/30'
                    : 'bg-gradient-to-r from-purple-950 via-slate-900 to-red-950 text-red-300 border border-red-600/50 hover:border-red-500 hover:text-white shadow-red-950/50'
                }`}
              >
                <div className="relative z-10 flex items-center justify-center gap-3">
                  <Flame className={`w-5 h-5 ${ultimateActive ? 'animate-bounce text-amber-300' : 'text-red-500'}`} />
                  <span>{ultimateActive ? 'ETERNAL EVIL ACTIVE (IMMORTAL)' : 'ACTIVATE ETERNAL EVIL'}</span>
                </div>
                {/* Button shine animation */}
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
              </button>
            </div>
          </div>

          {/* Hero Stats Card */}
          <div className="mt-8 p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-md shadow-2xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Activity className="w-4 h-4 text-red-500" /> Attributes & Ratings
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              {stats.map((st) => (
                <div key={st.label} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-300">{st.label}</span>
                    <span className="text-red-400 font-bold">{st.value}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden p-[1px]">
                    <div 
                      className={`h-full rounded-full bg-gradient-to-r ${st.color} transition-all duration-1000`}
                      style={{ width: `${st.value}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* MIDDLE AREA: 3D MODEL VIEWPORT FOCUS (HANDLED BY THREE CANVAS BACKGROUND) */}
        <div className="lg:col-span-2 hidden lg:flex items-center justify-center">
          {/* Subtle Viewport Guidance Overlay */}
          <div className="px-3 py-1.5 rounded-full bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 backdrop-blur-md animate-pulse">
            Drag to Orbit 3D Hero
          </div>
        </div>

        {/* RIGHT COLUMN: INTERACTIVE SKILL SHOWCASE CARDS */}
        <div className="lg:col-span-5 flex flex-col justify-end p-6 lg:p-12 pointer-events-auto">
          
          <div className="p-6 rounded-2xl bg-slate-900/75 border border-red-900/30 backdrop-blur-xl shadow-2xl space-y-6">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Swords className="w-5 h-5 text-red-500" /> Skill Kit Abilities
                </h3>
                <p className="text-xs text-slate-400">Click a skill icon to inspect details</p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded bg-red-950 text-red-400 border border-red-800 font-mono">
                MLBB v1.8.90
              </span>
            </div>

            {/* Skill Icon Selector Tabs */}
            <div className="grid grid-cols-4 gap-2">
              {skills.map((skill, idx) => (
                <button
                  key={skill.id}
                  onClick={() => {
                    setActiveSkill(idx);
                    playSoundEffect('click');
                  }}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                    activeSkill === idx
                      ? 'bg-gradient-to-b from-red-900/50 to-slate-900 border-red-500 text-white ring-2 ring-red-500/40 shadow-lg shadow-red-950'
                      : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <span className="text-2xl mb-1">{skill.icon}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider truncate w-full text-center">
                    {skill.name}
                  </span>
                </button>
              ))}
            </div>

            {/* Selected Skill Detail Panel */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-bold text-red-400 flex items-center gap-2">
                    {skills[activeSkill].name}
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-normal">
                      {skills[activeSkill].type}
                    </span>
                  </h4>
                </div>
                <div className="flex gap-3 text-xs font-mono text-slate-400">
                  <span>CD: <strong className="text-slate-200">{skills[activeSkill].cd}</strong></span>
                  <span>Mana: <strong className="text-slate-200">{skills[activeSkill].mana}</strong></span>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {skills[activeSkill].description}
              </p>

              <div className="text-[11px] text-red-300/80 bg-red-950/30 p-2.5 rounded-lg border border-red-900/30 flex items-start gap-2">
                <Zap className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                <span>{skills[activeSkill].details}</span>
              </div>
            </div>

            {/* Call to Action Footer */}
            <div className="pt-2 flex items-center gap-3">
              <button 
                onClick={() => alert('Launching Mobile Legends: Bang Bang Hero Trainer Mode...')}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-red-600 to-purple-700 text-white font-bold text-xs uppercase tracking-wider hover:opacity-95 transition shadow-lg shadow-red-900/30"
              >
                <Play className="w-4 h-4 fill-current" /> Play Argus Now
              </button>
            </div>

          </div>

        </div>

      </main>

      {/* LORE MODAL DIALOG */}
      {showLoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="relative w-full max-w-2xl p-6 lg:p-8 rounded-2xl bg-slate-900 border border-red-900/50 shadow-2xl space-y-6 max-h-[85vh] overflow-y-auto">
            
            <button 
              onClick={() => setShowLoreModal(false)}
              className="absolute top-4 right-4 p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
            >
              ✕
            </button>

            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <Award className="w-6 h-6 text-red-500" />
              <div>
                <h3 className="text-xl font-bold text-white">ARGUS - LORE & STORY</h3>
                <p className="text-xs text-red-400">Angel of Light transformed into Demonic Blade Master</p>
              </div>
            </div>

            <div className="space-y-4 text-xs lg:text-sm text-slate-300 leading-relaxed font-normal">
              <p>
                Argus and Rafaela were heavenly angels who descended upon the Land of Dawn together, charged with maintaining peace and eradicating darkness. While Rafaela healed the suffering, Argus stood on the frontlines to eradicate evil.
              </p>
              <p>
                During a tragic battle against an ancient demon lord, Argus sacrificed his soul to seal the creature's unholy weapon—the <strong>Demonic Blade</strong>. The weapon’s dark corruption gradually consumed Argus's mind, twisting his sacred wings into dark shadows and replacing his holy mission with an unquenchable thirst for battle.
              </p>
              <p>
                Now bound to eternal immortality through dark powers, Argus roams the battlefield wielding his curse, seeking enemies worthy enough to face his blade.
              </p>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800">
              <button
                onClick={() => setShowLoreModal(false)}
                className="px-6 py-2.5 rounded-lg bg-red-600 text-white font-bold text-xs uppercase tracking-wider hover:bg-red-500 transition"
              >
                Close Lore
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}