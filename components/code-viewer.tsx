"use client"

import { useState } from "react"
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { trackEvent } from "@/components/umami-analytics"

interface CodeViewerProps {
  code: string
  language: string
  filename: string
  className?: string
}

export function CodeViewer({ code, language, filename, className }: CodeViewerProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      trackEvent('code_copy', { filename, language, codeLength: code.length })
    } catch (err) {
      console.error('Failed to copy code:', err)
      trackEvent('code_copy_error', { filename, language, error: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  const codeDisplay = (
    <div className="relative group">
      <div className="absolute top-2 right-2 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleCopy}
          className="h-8 w-8 p-0 bg-zinc-800/80 hover:bg-zinc-700/80 border-zinc-600"
        >
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        customStyle={{
          margin: 0,
          borderRadius: '0.5rem',
          fontSize: '0.75rem',
        }}
        wrapLines={true}
        wrapLongLines={true}
        showLineNumbers={true}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )

  return (
    <div className={className}>
      {codeDisplay}
    </div>
  )
}