import React, { useState } from 'react';
import {
  Smartphone, Megaphone, Clapperboard, Fingerprint, Box,
  ArrowUpLeft, Sparkles, LockKeyhole, WandSparkles
} from 'lucide-react';
import { Language } from '../../lib/i18n';

type CreativeTool = 'mockups' | 'ads' | 'motion' | 'brand' | '3d';

interface CreativeStudioViewProps {
  lang: Language;
}

const TOOLS = [
  { id: 'mockups', icon: Smartphone, ar: 'موكابات التطبيقات', en: 'App & Web Mockups', descAr: 'اعرض واجهاتك داخل أجهزة ومشاهد عرض احترافية.', descEn: 'Present product interfaces inside polished device scenes.' },
  { id: 'ads', icon: Megaphone, ar: 'تصميم الإعلانات', en: 'Advertising Studio', descAr: 'جهّز حملات بصرية للمنتجات والتطبيقات والمنصات.', descEn: 'Create campaign concepts for products, apps, and platforms.' },
  { id: 'motion', icon: Clapperboard, ar: 'الحركة والفيديو', en: 'Motion & Video', descAr: 'خطط لفيديوهات ترويجية وانتقالات ومشاهد متحركة.', descEn: 'Plan promotional videos, transitions, and motion scenes.' },
  { id: 'brand', icon: Fingerprint, ar: 'الهوية البصرية', en: 'Brand Identity', descAr: 'ابنِ نظاماً متناسقاً للشعار والألوان والخطوط.', descEn: 'Build a consistent logo, color, and typography system.' },
  { id: '3d', icon: Box, ar: 'مختبر الأصول ثلاثية الأبعاد', en: '3D Asset Lab', descAr: 'جهّز مشاهد وعناصر ثلاثية الأبعاد للعرض والتسويق.', descEn: 'Prepare 3D scenes and assets for product presentation.' },
] as const;

export const CreativeStudioView: React.FC<CreativeStudioViewProps> = ({ lang }) => {
  const [activeTool, setActiveTool] = useState<CreativeTool>('mockups');
  const rtl = lang === 'ar';
  const selected = TOOLS.find((tool) => tool.id === activeTool)!;
  const SelectedIcon = selected.icon;

  return (
    <main className="forge-page forge-creative-page" dir={rtl ? 'rtl' : 'ltr'}>
      <div className="forge-page-kicker"><Sparkles size={14} /> {rtl ? 'مساحة الإبداع والتسويق' : 'CREATIVE & BRAND EXPERIENCE'}</div>
      <div className="forge-page-heading-row">
        <div>
          <h1 className="forge-page-title">{rtl ? 'حوّل أفكارك إلى تجربة بصرية' : 'Turn ideas into visual experiences'}</h1>
          <p className="forge-page-subtitle">{rtl ? 'استوديو موحد لتقديم التطبيقات والمنتجات وصناعة المواد التسويقية.' : 'A unified studio for presenting apps, products, and marketing assets.'}</p>
        </div>
        <div className="forge-owner-pill"><span className="forge-status-dot" />{rtl ? 'وضع المطوّر والاختبار' : 'Owner development mode'}</div>
      </div>

      <section className="forge-creative-hero">
        <div className="forge-creative-hero-copy">
          <span className="forge-eyebrow">{rtl ? 'CREATIVE STUDIO' : 'CREATIVE STUDIO'}</span>
          <h2>{rtl ? 'كل أدوات العرض والإبداع، في مساحة واحدة.' : 'Every creative workflow, in one place.'}</h2>
          <p>{rtl ? 'ابدأ من واجهة تطبيقك، وحوّلها إلى موكاب، ثم جهّز حملة إعلانية ومشهد فيديو متناسق.' : 'Start with your product interface, turn it into a mockup, then shape a campaign and a cohesive video concept.'}</p>
          <div className="forge-hero-note"><WandSparkles size={16} /> {rtl ? 'المزايا التي تحتاج محرك توليد خارجي ستظهر بوضوح قبل تشغيلها.' : 'Features requiring external generation engines are clearly identified before use.'}</div>
        </div>
        <div className="forge-creative-art" aria-hidden="true">
          <div className="forge-art-orbit forge-art-orbit-one" />
          <div className="forge-art-orbit forge-art-orbit-two" />
          <div className="forge-art-device"><div className="forge-art-device-top" /><div className="forge-art-screen-glow" /><div className="forge-art-screen-lines"><i /><i /><i /></div></div>
          <div className="forge-art-float forge-art-float-a"><Sparkles size={19} /></div>
          <div className="forge-art-float forge-art-float-b"><Box size={20} /></div>
        </div>
      </section>

      <div className="forge-section-heading">
        <div><h3>{rtl ? 'اختر مساحة العمل' : 'Choose your creative workspace'}</h3><p>{rtl ? 'كل أداة لها مسار عمل وحالة تكامل مستقلة.' : 'Each tool has its own workflow and integration status.'}</p></div>
        <span className="forge-section-count">05 {rtl ? 'أدوات' : 'TOOLS'}</span>
      </div>
      <section className="forge-creative-grid">
        {TOOLS.map((tool, index) => {
          const Icon = tool.icon;
          const selectedCard = activeTool === tool.id;
          return (
            <button key={tool.id} type="button" onClick={() => setActiveTool(tool.id)} className={`forge-tool-card ${selectedCard ? 'is-selected' : ''}`}>
              <div className={`forge-tool-visual forge-tool-visual-${index + 1}`}><Icon size={27} strokeWidth={1.5} /><span>0{index + 1}</span></div>
              <div className="forge-tool-copy"><h4>{rtl ? tool.ar : tool.en}</h4><p>{rtl ? tool.descAr : tool.descEn}</p></div>
              <ArrowUpLeft size={17} className="forge-tool-arrow" />
            </button>
          );
        })}
      </section>
      <section className="forge-tool-detail">
        <div className="forge-tool-detail-icon"><SelectedIcon size={22} /></div>
        <div className="forge-tool-detail-copy"><span className="forge-eyebrow">{rtl ? 'مساحة محددة' : 'SELECTED WORKSPACE'}</span><h3>{rtl ? selected.ar : selected.en}</h3><p>{rtl ? 'واجهة الاستوديو جاهزة للتكامل، لكن محرك الإنشاء والتصدير لهذه الأداة لم يتم ربطه بعد.' : 'The workspace entry is ready, but this tool’s generation and export engine has not been connected yet.'}</p></div>
        <div className="forge-integration-state"><LockKeyhole size={15} /><span>{rtl ? 'يتطلب ربط المحرك' : 'Engine integration required'}</span></div>
      </section>
    </main>
  );
};
