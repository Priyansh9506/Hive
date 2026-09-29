import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Links in model output open in a new tab, so following one never drops the
// member out of the workspace (and their unsent work).
const components = {
  // `node` is react-markdown's syntax-tree node, not a DOM attribute
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
};

/**
 * Renders markdown from the AI assistant. react-markdown builds React elements
 * rather than injecting HTML, so model output cannot run script in the page.
 */
export default function Markdown({ children, className = '' }) {
  return (
    <div
      className={`prose prose-sm max-w-none prose-headings:font-semibold prose-headings:text-gray-900 prose-h2:text-base prose-h3:text-sm prose-p:leading-relaxed prose-li:my-0.5 prose-table:text-xs prose-code:before:content-none prose-code:after:content-none prose-code:bg-gray-100 prose-code:px-1 prose-code:rounded ${className}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
