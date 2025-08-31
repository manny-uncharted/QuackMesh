import type { MDXComponents } from 'mdx/types';

// This file is required when using @next/mdx with the App Router.
// It lets you customize or provide default components for MDX.
// Keeping the default passthrough ensures MDX compiles without trying to import
// the legacy 'next-mdx-import-source-file' alias.
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
  };
}
