'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { CheckCircle, Sparkles, Lightbulb, ChevronDown } from 'lucide-react'
import { useState, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { convertReferencesToMarkdownLinks, createReferenceLinkComponent, convertIdCitations } from '@/lib/utils/source-references'
import { sanitizeMarkdown } from '@/lib/utils/markdown-security'
import { useModalManager } from '@/lib/hooks/use-modal-manager'
import { useI18n } from '@/lib/i18n'
import { toast } from 'sonner'
import { CitationCard, type CitationData } from '@/components/common/CitationCard'

interface StrategyData {
  reasoning: string
  searches: Array<{ term: string; instructions: string }>
}

interface StreamingResponseProps {
  isStreaming: boolean
  strategy: StrategyData | null
  answers: string[]
  finalAnswer: string | null
}

export function StreamingResponse({
  isStreaming,
  strategy,
  answers,
  finalAnswer
}: StreamingResponseProps) {
  const [strategyOpen, setStrategyOpen] = useState(false)
  const [answersOpen, setAnswersOpen] = useState(false)
  const { openModal } = useModalManager()
  const { t } = useI18n()

  const handleReferenceClick = (type: string, id: string) => {
    if (type === 'source_insight') {
      toast.error(t('chat.insightDisabled'))
      return
    }
    const modalType = type as 'source' | 'note'

    try {
      openModal(modalType, id)
      // Note: The modal system uses URL parameters and doesn't throw errors for missing items.
      // The modal component itself will handle displaying "not found" states.
      // This try-catch is here for future enhancements or unexpected errors.
    } catch {
      const typeLabel =
        type === 'note' ? t('chat.referenceType.note') : t('chat.referenceType.source')
      toast.error(t('chat.referenceMissing', { type: typeLabel }))
    }
  }

  if (!strategy && !answers.length && !finalAnswer && !isStreaming) {
    return null
  }

  return (
    <div
      className="space-y-4 mt-6 max-h-[60vh] overflow-y-auto pr-2"
      role="region"
      aria-label="Ask response"
      aria-live="polite"
      aria-busy={isStreaming}
    >
      {/* Strategy Section - Collapsible */}
      {strategy && (
        <Collapsible open={strategyOpen} onOpenChange={setStrategyOpen}>
          <Card>
            <CardHeader>
              <CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-80">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Strategy
                </CardTitle>
                <ChevronDown className={`h-4 w-4 transition-transform ${strategyOpen ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-3 pt-0">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Reasoning:</p>
                  <p className="text-sm">{strategy.reasoning}</p>
                </div>
                {strategy.searches.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Search Terms:</p>
                    <div className="space-y-2">
                      {strategy.searches.map((search, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <Badge variant="outline" className="mt-0.5">{i + 1}</Badge>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{search.term}</p>
                            <p className="text-xs text-muted-foreground">{search.instructions}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Individual Answers Section - Collapsible */}
      {answers.length > 0 && (
        <Collapsible open={answersOpen} onOpenChange={setAnswersOpen}>
          <Card>
            <CardHeader>
              <CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-80">
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  Individual Answers ({answers.length})
                </CardTitle>
                <ChevronDown className={`h-4 w-4 transition-transform ${answersOpen ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-2 pt-0">
                {answers.map((answer, i) => (
                  <div key={i} className="p-3 rounded-md bg-muted">
                    <p className="text-sm">{answer}</p>
                  </div>
                ))}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Final Answer Section - Always Open */}
      {finalAnswer && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-primary" />
              Final Answer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FinalAnswerContent
              content={finalAnswer}
              onReferenceClick={handleReferenceClick}
            />
          </CardContent>
        </Card>
      )}

      {/* Loading Indicator */}
      {isStreaming && !finalAnswer && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoadingSpinner size="sm" />
          <span>Processing your question...</span>
        </div>
      )}
    </div>
  )
}

// Helper component to render final answer with clickable references and hoverable citations
function FinalAnswerContent({
  content,
  onReferenceClick
}: {
  content: string
  onReferenceClick: (type: string, id: string) => void
}) {
  // Parse ID citations from backend format [ID: x] Content: (doc: xxx, layer: yyy) ...
  const { processedText: processedIdCitations, citations: idCitations } = useMemo(
    () => convertIdCitations(content),
    [content]
  )

  // Create a citation lookup map
  const citationMap = useMemo(() => {
    const map = new Map<number, CitationData>()
    for (const citation of idCitations) {
      map.set(citation.id, {
        id: citation.id,
        docId: citation.docId,
        docName: citation.docName,
        layer: citation.layer,
        content: citation.content
      })
    }
    return map
  }, [idCitations])

  // Convert references to markdown links and sanitize
  const safeMarkdown = useMemo(() => {
    const markdownWithLinks = convertReferencesToMarkdownLinks(processedIdCitations);
    return sanitizeMarkdown(markdownWithLinks);
  }, [processedIdCitations]);

  // Create custom link component
  const LinkComponent = createReferenceLinkComponent(onReferenceClick)

  return (
    <div className="prose prose-sm max-w-none dark:prose-invert break-words prose-a:break-all prose-p:leading-relaxed prose-headings:mt-4 prose-headings:mb-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...props }) => {
            // Check if this is a numbered citation link [1], [2], etc.
            const citationMatch = href?.match(/^#ref-citation-(\d+)$/)
            if (citationMatch) {
              const citationId = parseInt(citationMatch[1], 10)
              const citation = citationMap.get(citationId)
              if (citation) {
                return (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Badge
                        variant="outline"
                        className="text-xs h-5 px-1.5 hover:bg-accent cursor-pointer"
                      >
                        {children}
                      </Badge>
                    </PopoverTrigger>
                    <PopoverContent
                      className="p-0 max-w-md w-auto z-50"
                      align="start"
                      sideOffset={4}
                    >
                      <CitationCard citation={citation} visible={true} />
                    </PopoverContent>
                  </Popover>
                )
              }
            }
            // Use the default link component for other links
            return <LinkComponent href={href} {...props}>{children}</LinkComponent>
          },
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto">
              <table className="min-w-full border-collapse border border-border">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => <tr className="border-b border-border">{children}</tr>,
          th: ({ children }) => <th className="border border-border px-3 py-2 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border border-border px-3 py-2">{children}</td>,
        }}
      >
        {safeMarkdown}
      </ReactMarkdown>
    </div>
  )
}
