import { Link } from "react-router-dom";
import type { LinkProps } from "react-router-dom";
import type { ReactNode, AnchorHTMLAttributes } from "react";

type AppLinkProps = {
  to: string;
  children: ReactNode;
  className?: string;
  externalTargetBlank?: boolean;
} & (LinkProps | AnchorHTMLAttributes<HTMLAnchorElement>);

/**
 * 统一链接组件：自动判断内部路由或外部链接
 * - 内部路由（以 / 开头）：使用 react-router-dom Link
 * - 外部链接（http/https）：使用 <a> 标签，默认新窗口打开
 */
export function AppLink({ to, children, className, externalTargetBlank = true, ...props }: AppLinkProps) {
  const isExternal = /^https?:\/\//i.test(to);
  
  // 准备 className：只有当它是有效字符串时才传递，避免传递 undefined/null/false
  // 这样可以避免 React 警告："Invalid value for prop `className`"
  const classNameProps = className ? { className } : {};

  if (isExternal) {
    return (
      <a 
        href={to} 
        target={externalTargetBlank ? "_blank" : undefined} 
        rel="noreferrer" 
        {...classNameProps}
        {...(props as AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {children}
      </a>
    );
  }

  if (!to.startsWith("/")) {
    throw new Error(
      `AppLink: Internal routes must start with '/'. ` +
      `Use absolute paths like '/about' instead of relative paths like 'about'. ` +
      `Current value: "${to}". ` +
      `Example: <AppLink to="/about">About</AppLink>`
    );
  }

  return (
    <Link to={to} {...classNameProps} {...(props as LinkProps)}>
      {children}
    </Link>
  );
}
