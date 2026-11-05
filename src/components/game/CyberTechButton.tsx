"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import "./cyber-tech-button.css";

export type CyberTechButtonVariant = "cyan" | "magenta" | "amber";

export type CyberTechButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  children: ReactNode;
  /** Keep children as direct button descendants for existing widget selectors. */
  preserveChildren?: boolean;
  variant?: CyberTechButtonVariant;
};

export const CyberTechButton = forwardRef<HTMLButtonElement, CyberTechButtonProps>(
  function CyberTechButton({ children, className = "", preserveChildren = false, type = "button", variant = "cyan", ...props }, ref) {
    return <button
      {...props}
      ref={ref}
      type={type}
      className={`cyber-tech-button cyber-tech-button--${variant}${preserveChildren ? " cyber-tech-button--preserve-children" : ""} ${className}`.trim()}
    >
      {preserveChildren ? children : <>
        <span className="cyber-tech-button__rail" aria-hidden="true" />
        <span className="cyber-tech-button__content">{children}</span>
        <span className="cyber-tech-button__corner" aria-hidden="true" />
      </>}
    </button>;
  },
);

CyberTechButton.displayName = "CyberTechButton";

export default CyberTechButton;
