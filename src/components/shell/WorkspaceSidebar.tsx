import React from 'react';
import {
  Home, Sparkles, Code2, FlaskConical, Palette, FolderGit2,
  Blocks, Rocket, Settings2, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Language } from '../../lib/i18n';

export type WorkspaceSection =
  | 'home' | 'studio' | 'workspace' | 'lab' | 'creative'
  | 'projects' | 'integrations' | 'release' | 'settings';

interface WorkspaceSidebarProps {
  active: WorkspaceSection;
  lang: Language;
  onNavigate: (section: WorkspaceSection) => void;
  collapsed: boolean;
  onToggle: () => void;
}

const ITEMS = [
  { id: 'home', icon: Home, ar: 'نظرة عامة', en: 'Overview' },
  { id: 'studio', icon: Sparkles, ar: 'مساحة الذكاء', en: 'AI Workspace' },
  { id: 'workspace', icon: Code2, ar: 'هندسة المشاريع', en: 'Engineering' },
  { id: 'lab', icon: FlaskConical, ar: 'مختبر الاختبار', en: 'Project Lab' },
  { id: 'creative', icon: Palette, ar: 'استوديو الإبداع', en: 'Creative Studio' },
  { id: 'projects', icon: FolderGit2, ar: 'المشاريع والمستودعات', en: 'Projects & Repos' },
  { id: 'integrations', icon: Blocks, ar: 'النماذج والتكاملات', en: 'Models & Integrations' },
  { id: 'release', icon: Rocket, ar: 'مركز الإصدارات', en: 'Release Center' },
  { id: 'settings', icon: Settings2, ar: 'الإعدادات', en: 'Settings' },
] as const;

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  active, lang, onNavigate, collapsed, onToggle
}) => {
  const rtl = lang === 'ar';
  return (
    <aside
      className={`forge-sidebar ${collapsed ? 'forge-sidebar--collapsed' : ''}`}
      aria-label={rtl ? 'التنقل الرئيسي' : 'Primary navigation'}
    >
      <div className="forge-sidebar-brand">
        <div className="forge-brand-mark"><Sparkles size={19} /></div>
        {!collapsed && <div className="min-w-0"><div className="forge-brand-name">FORGEX <span>AI</span></div><div className="forge-brand-caption">ENGINEERING WORKSPACE</div></div>}
      </div>
      <div className="forge-sidebar-label">{rtl ? 'مساحة العمل' : 'WORKSPACE'}</div>
      <nav className="forge-nav-list">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const selected = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`forge-nav-item ${selected ? 'is-active' : ''}`}
              onClick={() => onNavigate(item.id)}
              aria-current={selected ? 'page' : undefined}
              title={collapsed ? (rtl ? item.ar : item.en) : undefined}
            >
              <Icon size={18} strokeWidth={1.8} />
              {!collapsed && <span>{rtl ? item.ar : item.en}</span>}
              {selected && <span className="forge-nav-indicator" />}
            </button>
          );
        })}
      </nav>
      <div className="forge-sidebar-bottom">
        <button type="button" className="forge-collapse-button" onClick={onToggle} aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}>
          {collapsed ? (rtl ? <ChevronLeft size={17} /> : <ChevronRight size={17} />) : (rtl ? <ChevronRight size={17} /> : <ChevronLeft size={17} />)}
          {!collapsed && <span>{rtl ? 'تصغير القائمة' : 'Collapse sidebar'}</span>}
        </button>
      </div>
    </aside>
  );
};
