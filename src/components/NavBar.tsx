import { AppLink } from './AppLink';
import { routes } from '@/routes';
import { NavLink } from 'react-router-dom';
import { ClipboardCheck, Gauge } from 'lucide-react';

/**
 * Site navigation bar for Zeekr 007GT Buying Decision Report.
 */
export function NavBar() {
  return (
    <nav className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <AppLink to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-primary text-primary-foreground rounded flex items-center justify-center">
              <Gauge className="h-4 w-4" aria-hidden="true" />
            </div>
            <span className="font-bold group-hover:text-primary transition-colors">
              极氪 007GT <span className="text-muted-foreground font-normal">焕新版报告</span>
            </span>
          </AppLink>
          
          <div className="hidden md:flex items-center gap-6">
            {routes.map((r) => (
              <NavLink
                key={r.path} 
                to={r.path} 
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors ${
                    isActive ? 'text-primary' : 'text-foreground/70 hover:text-primary'
                  }`
                }
              >
                {r.label}
              </NavLink>
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <AppLink 
            to="/action" 
            className="bg-accent text-accent-foreground px-4 py-2 rounded text-sm font-bold hover:opacity-90 transition-opacity inline-flex items-center gap-2"
          >
            <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
            购车建议
          </AppLink>
        </div>
      </div>
    </nav>
  );
}
