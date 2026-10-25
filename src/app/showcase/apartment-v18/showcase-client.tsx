'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createApartmentFixture } from '@/components/apartment-v21/fixture';
import { APARTMENT_ASSETS, type ApartmentAssetId } from '@/components/apartment-v21/asset-registry';
import { FIXED_APARTMENT_PLOT } from '@/construction/migration';
import './v18.css';

type ShowcaseFocus = 'benchmark' | 'bed' | 'sofa' | 'desk' | 'kitchen' | 'window';

const ConstructionWorld = dynamic(() => import('@/components/construction/ConstructionWorld'), {
  ssr: false,
  loading: () => <div className="v18-loading" role="status">Đang tải renderer căn hộ thống nhất…</div>,
});

const FOCUS_BUTTONS: readonly { id: ShowcaseFocus; label: string; asset?: ApartmentAssetId }[] = [
  { id: 'benchmark', label: 'Toàn cảnh' },
  { id: 'bed', label: APARTMENT_ASSETS.bed.label, asset: 'bed' },
  { id: 'sofa', label: APARTMENT_ASSETS.sofa.label, asset: 'sofa' },
  { id: 'desk', label: APARTMENT_ASSETS.desk.label, asset: 'desk' },
  { id: 'kitchen', label: APARTMENT_ASSETS.kitchen.label, asset: 'kitchen' },
  { id: 'window', label: 'Panorama' },
];

function emitFocus(focus: ShowcaseFocus) {
  window.dispatchEvent(new CustomEvent('life-level:showcase-focus', { detail: { focus } }));
}

export default function ShowcaseClient() {
  const [focus, setFocus] = useState<ShowcaseFocus>('benchmark');
  const [starter, setStarter] = useState(false);
  const [cameraMode, setCameraMode] = useState<'follow' | 'free'>('free');
  const [fps, setFps] = useState(0);
  const [rendererReady, setRendererReady] = useState(false);
  const [rendererSlow, setRendererSlow] = useState(false);
  const [notice, setNotice] = useState('');
  const initialFocusApplied = useRef(false);
  const plan = useMemo(() => createApartmentFixture(starter), [starter]);

  useEffect(() => {
    const timer = window.setTimeout(() => emitFocus('benchmark'), 0);
    return () => window.clearTimeout(timer);
  }, [starter]);

  useEffect(() => {
    initialFocusApplied.current = false;
  }, [starter]);

  // A GLB may take longer than the first React paint on a cold browser cache.
  // Do not leave the user looking at an indefinite "initializing" label: the
  // real Canvas reports readiness immediately, and only a genuinely stalled
  // renderer reaches this recovery hint.
  useEffect(() => {
    if (rendererReady) return;
    const timer = window.setTimeout(() => setRendererSlow(true), 15000);
    return () => window.clearTimeout(timer);
  }, [starter, rendererReady]);

  useEffect(() => {
    if (fps > 0 && !initialFocusApplied.current) {
      initialFocusApplied.current = true;
      emitFocus(focus);
    }
  }, [fps, focus]);

  const chooseFocus = (next: ShowcaseFocus) => {
    setFocus(next);
    if (cameraMode !== 'free') {
      setCameraMode('free');
      window.setTimeout(() => emitFocus(next), 0);
    } else {
      emitFocus(next);
    }
  };

  const assetNotice = notice.startsWith('Không tải được nội thất 3D');

  return <main className="v18-page">
    <div className="v18-canvas" aria-label="Căn hộ thống nhất dùng chung renderer với Home">
      <ConstructionWorld
        plan={plan}
        plot={FIXED_APARTMENT_PLOT}
        mode="live"
        cameraMode={cameraMode}
        onCameraModeChange={mode => { if (mode !== 'build') setCameraMode(mode); }}
        tool="select"
        floorLevel={0}
        residenceFloor={8}
        cutaway
        showReferencePenthouse
        showCeiling={false}
        onGesture={() => {}}
        onInteract={() => {}}
        onFps={value => { setFps(value); if (value > 0) setRendererSlow(false); }}
        onReady={() => { setRendererReady(true); setRendererSlow(false); }}
        onNotice={setNotice}
        onContextLost={() => setNotice('Kết nối WebGL bị ngắt. Hãy tải lại để khôi phục renderer.')}
        quality="high"
      />
    </div>
    <header className="v18-heading"><span>LIFE<span className="v18-accent">{'//'}</span>LEVEL</span><small>NEON HAVEN · UNIFIED APARTMENT RENDERER</small></header>
    <div className="v18-state" role="status">{notice && !assetNotice ? 'WEBGL BỊ NGẮT' : fps ? `HOME PIPELINE · ${fps} FPS` : rendererReady ? 'CẢNH 3D ĐÃ SẴN SÀNG' : rendererSlow ? 'ĐANG TẢI TÀI NGUYÊN 3D…' : 'ĐANG KHỞI TẠO 3D…'}</div>
    {rendererSlow && !rendererReady && !notice && <div className="v18-slow-load" role="status"><strong>Đang tải nội thất 3D…</strong><span>Khung 3D vẫn đang hoạt động; có thể tiếp tục quan sát cảnh.</span><button type="button" onClick={() => location.reload()}>Tải lại 3D</button></div>}
    {assetNotice && <div className="v18-asset-notice" role="alert">{notice}</div>}
    {notice && !assetNotice && <div className="v18-loading" role="alert"><span>{notice}</span><button onClick={() => location.reload()}>Tải lại 3D</button></div>}
    <nav className="v18-toolbar" aria-label="Góc kiểm tra căn hộ">
      {FOCUS_BUTTONS.map(button => <button key={button.id} aria-pressed={focus === button.id} onClick={() => chooseFocus(button.id)}>{button.label}</button>)}
      <span />
      <button aria-pressed={starter} onClick={() => { setStarter(value => !value); setFocus('benchmark'); }}>Căn hộ {starter ? 'cơ bản' : 'phát triển'}</button>
      <button aria-pressed={cameraMode === 'free'} onClick={() => setCameraMode('free')}>Tự do</button>
      <button aria-pressed={cameraMode === 'follow'} onClick={() => setCameraMode('follow')}>Theo nhân vật</button>
      <Link href="/">Về game</Link>
    </nav>
    <p className="v18-footnote">FIXTURE CHỈ ĐỌC · CÙNG KIẾN TRÚC, GLB, VẬT LIỆU, ÁNH SÁNG VÀ CAMERA VỚI HOME · KHÔNG GHI SAVE</p>
  </main>;
}
