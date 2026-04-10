import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, LogIn, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export function Navbar() {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { isAuthenticated, profile } = useAuth();
  const isAdmin = profile?.role === 'internal_admin' || profile?.role === 'client_admin';

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  // Handle scroll listener to detect when to shrink the navbar.
  // Hysteresis: shrink at 80px, expand only when back above 30px.
  // requestAnimationFrame prevents layout thrashing.
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const y = window.scrollY;
          setIsScrolled(prev => prev ? y > 30 : y > 80);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const links = [
    { href: "/", label: "HOME" },
    { href: "/services", label: "SERVICES" },
    { href: "/about-me", label: "ABOUT" },
    { href: "/insights", label: "INSIGHTS" },
    { href: "/contact", label: "CONTACT" },
  ];

  // Expanded navbar height: logo (110px) + py-10 (80px) + nav bar (~44px) ≈ 234px
  // This wrapper reserves that space so content never shifts when the navbar shrinks.
  const EXPANDED_HEIGHT = 234;

  return (
    <>
      {/* Height reservation — invisible spacer that holds the expanded navbar height.
          Desktop: full expanded height. Mobile: compact navbar height (~71px). */}
      <div className="hidden md:block" style={{ height: `${EXPANDED_HEIGHT}px` }} />
      <div className="md:hidden" style={{ height: '71px' }} />

      <nav className={`fixed top-0 left-0 right-0 z-50 w-full transition-all duration-500 ease-out flex flex-col ${
        isScrolled ? "bg-white/95 backdrop-blur-sm shadow-md border-b border-gray-100" : "bg-white"
      }`}>

      {/* ========================================================= */}
      {/* DESKTOP LAYOUT (Center Stacked)                           */}
      {/* ========================================================= */}
      <div className="hidden md:flex flex-col w-full">
        {/* Logo Section */}
        <div className={`transition-all duration-500 ease-out flex justify-center w-full ${
          isScrolled ? "py-2" : "py-10"
        }`}>
          <Link href="/">
            <div className="cursor-pointer transition-transform hover:scale-[1.01] flex flex-col justify-center">
              <img
                src="/images/carlorbiz-logo.webp"
                alt="Carlorbiz Logo"
                className={`transition-all duration-500 ease-out w-auto object-contain ${
                  isScrolled ? "h-[40px]" : "h-[110px]"
                }`}
              />
            </div>
          </Link>
        </div>

        {/* Navigation Links Section */}
        <div className={`transition-all duration-500 ease-out flex justify-center w-full border-t border-transparent ${
          isScrolled ? "bg-white/95 pb-2" : "bg-[#F9F9F9] py-3"
        }`}>
          <div className="flex items-center gap-10">
            {links.map((link) => {
              const isActive = location === link.href || (location.startsWith(link.href) && link.href !== "/");
              return (
                <Link key={link.href} href={link.href}>
                  <span className={`font-body font-bold text-sm tracking-[0.1em] transition-all duration-300 cursor-pointer relative py-1 ${
                    isActive ? "text-[#2D7E32]" : "text-[#556059] hover:text-[#2D7E32]"
                  }`}>
                    {link.label}
                    {isActive && (
                      <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[#D5B13A] rounded-full transform translate-y-2" />
                    )}
                  </span>
                </Link>
              );
            })}
            <Link href={isAdmin ? "/admin" : "/login"}>
              <span className="text-gray-400 hover:text-[#2D7E32] transition-colors cursor-pointer" title={isAdmin ? "Admin" : "Sign in"}>
                {isAdmin ? <Settings className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MOBILE LAYOUT (Classic Inline Row)                        */}
      {/* ========================================================= */}
      <div className="md:hidden flex w-full items-center justify-between px-4 py-3 bg-white border-b border-gray-100 shadow-sm">
        <Link href="/">
          <div className="cursor-pointer transition-transform hover:scale-[1.02]">
            <img 
              src="/images/carlorbiz-logo.webp" 
              alt="Carlorbiz Logo" 
              className="h-[46px] w-auto object-contain"
            />
          </div>
        </Link>

        {/* Mobile Menu Toggle Button */}
        <Button 
          variant="ghost" 
          size="icon" 
          aria-label="Toggle Menu"
          className="text-[#2E4A3A] hover:bg-gray-100/50"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? (
            <X className="h-7 w-7 transition-all duration-300 transform rotate-90" />
          ) : (
            <Menu className="h-7 w-7 transition-all duration-300" />
          )}
        </Button>
      </div>

      {/* Mobile Menu Dropdown Panel */}
      <div className={`md:hidden absolute top-[71px] left-0 w-full bg-white shadow-xl transition-all duration-300 ease-in-out border-t border-gray-50 overflow-hidden ${
        isMobileMenuOpen ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
      }`}>
        <div className="flex flex-col px-6 py-4 space-y-4">
          {links.map((link) => {
            const isActive = location === link.href || (location.startsWith(link.href) && link.href !== "/");
            return (
              <Link key={link.href} href={link.href}>
                <div className={`font-body font-bold text-base tracking-[0.1em] py-3 border-b border-gray-50 cursor-pointer transition-colors ${
                  isActive ? "text-[#2D7E32]" : "text-[#2E4A3A]"
                }`}>
                  {link.label}
                </div>
              </Link>
            );
          })}
          <Link href={isAdmin ? "/admin" : "/login"}>
            <div className="font-body text-sm tracking-[0.1em] py-3 cursor-pointer transition-colors text-gray-400 hover:text-[#2D7E32] flex items-center gap-2">
              {isAdmin ? <><Settings className="h-4 w-4" /> Admin</> : <><LogIn className="h-4 w-4" /> Sign in</>}
            </div>
          </Link>
        </div>
      </div>

    </nav>
    </>
  );
}
