/**
 * Custom recall test for test.pdf (OO concepts) using three-layer RAG
 * - Loads latest processed document (status=completed, chunk_count>0)
 * - Uses ragRetrieve (document+parent+child) with kbId filter
 * - Checks keyword coverage across all returned context
 */
import 'dotenv/config'
import { initializeDatabase, db } from '../lib/db/schema'
import { ragRetrieve } from '../lib/rag/retrieval'
import axios from 'axios'

const USE_RERANK = process.env.USE_RERANK !== '0'
const RERANK_MODEL = process.env.RERANK_MODEL || 'qwen3-reranker-4b'
const LITELLM_BASE_URL = process.env.LITELLM_BASE_URL || 'http://localhost:4000'
// LiteLLM 暴露的 rerank 端点是 /rerank（非 /v1/rerank），与 embedding 走 LiteLLM 的方式保持一致
const RERANK_URL = new URL('/rerank', LITELLM_BASE_URL).toString()
const LITELLM_API_KEY = process.env.LITELLM_API_KEY || 'sk-not-needed'
const RERANK_TIMEOUT_MS = parseInt(process.env.RERANK_TIMEOUT_MS || '30000')

type Question = {
  id: string
  category: string
  query: string
  keywords: string[]
  expected_content_summary: string
}

const QUESTIONS: Question[] = [
  // group 1
  {
    id: 'q_001',
    category: 'L1_Definition',
    query: 'What is the relationship between a Class and an Object?',
    keywords: ['template', 'blueprint', 'cookie cutter', 'instantiate'],
    expected_content_summary:
      "A class is a blueprint, template, or 'cookie cutter' that defines the attributes and behaviors. An object is a specific instance created from that class, like a cookie made from the cutter.",
  },
  {
    id: 'q_002',
    category: 'L1_Definition',
    query: "Define Encapsulation and explaining the 'Black Box' concept.",
    keywords: ['hiding', 'interface', 'black box', 'implementation details'],
    expected_content_summary:
      'Encapsulation hides the internal implementation details of an object (like a black box). Users interact with it only through a public interface, ensuring data integrity and security.',
  },
  {
    id: 'q_003',
    category: 'L2_Comparison',
    query: 'What is the difference between an Interface and an Abstract Class?',
    keywords: ['contract', 'implementation', 'instantiated', 'abstract methods'],
    expected_content_summary:
      'An interface is a strict contract with no implementation logic (in traditional OO). An abstract class can contain some implemented methods but cannot be instantiated directly; it serves as a base for subclasses.',
  },
  {
    id: 'q_004',
    category: 'L2_Comparison',
    query: "Explain 'Is-a' vs 'Has-a' relationships in object-oriented design.",
    keywords: ['inheritance', 'composition', 'relationship', 'hierarchy'],
    expected_content_summary:
      "'Is-a' refers to Inheritance (e.g., a Dog is a Mammal). 'Has-a' refers to Composition or Aggregation (e.g., a Car has a Engine). Composition is often preferred for flexibility.",
  },
  {
    id: 'q_005',
    category: 'L3_Concept',
    query: 'How does Polymorphism help in writing maintainable code?',
    keywords: ['many forms', 'override', 'dynamic binding', 'flexibility'],
    expected_content_summary:
      'Polymorphism allows different objects to allow the same method call (message) but execute different behaviors. This decouples the caller from specific class implementations, making code easier to extend.',
  },
  {
    id: 'q_006',
    category: 'L1_Definition',
    query: 'What is the purpose of a Constructor?',
    keywords: ['initialization', 'instantiation', 'state', 'method'],
    expected_content_summary:
      "A constructor is a special method called automatically when an object is instantiated. Its primary purpose is to initialize the object's state (attributes) to valid defaults.",
  },
  {
    id: 'q_007',
    category: 'L3_Concept',
    query: 'Why should attributes usually be declared as Private?',
    keywords: ['public interface', 'access modifiers', 'control', 'direct access'],
    expected_content_summary:
      'Attributes should be private to enforce Encapsulation. This prevents external code from invalidating the object\'s state and forces access through public getter/setter methods (the interface).',
  },
  {
    id: 'q_008',
    category: 'L2_Comparison',
    query: 'Compare Method Overloading and Method Overriding.',
    keywords: ['signature', 'parameters', 'inheritance', 'runtime'],
    expected_content_summary:
      'Overloading occurs within the same class (same name, different parameters). Overriding occurs in a subclass (redefining a method inherited from a parent class with the same signature).',
  },
  {
    id: 'q_009',
    category: 'L2_Comparison',
    query: 'Why is Composition often preferred over Inheritance?',
    keywords: ['coupling', 'fragile base class', 'flexibility', 'reuse'],
    expected_content_summary:
      "Inheritance creates a tight coupling between parent and child classes. Composition provides more flexibility by assembling objects at runtime and avoids the 'fragile base class' problem.",
  },
  {
    id: 'q_010',
    category: 'L1_Definition',
    query: 'What role does UML (Unified Modeling Language) play in OO design?',
    keywords: ['visual', 'diagram', 'communication', 'blueprint'],
    expected_content_summary:
      "UML provides a standard visual language to model hierarchies, relationships, and system architecture before coding, acting as the blueprint for developers.",
  },
  // group 2
  {
    id: 'q_011',
    category: 'L3_Concept',
    query: 'How can Object Wrappers be used to integrate legacy procedural code?',
    keywords: ['wrapper', 'legacy code', 'encapsulate', 'non-object'],
    expected_content_summary:
      'Object wrappers allow developers to take existing procedural code (legacy systems) and wrap it inside a class. This allows new OO systems to interact with the old code through a clean object interface without rewriting the legacy logic.',
  },
  {
    id: 'q_012',
    category: 'L1_Definition',
    query: 'What is the difference between a Class Variable (Static) and an Instance Variable?',
    keywords: ['static', 'shared', 'instance', 'memory', 'copy'],
    expected_content_summary:
      'An instance variable belongs to a specific object; each object has its own copy. A class variable (static) is shared among all instances of that class; there is only one copy in memory.',
  },
  {
    id: 'q_013',
    category: 'L2_Comparison',
    query: 'Distinguish between Composition and Aggregation.',
    keywords: ['lifecycle', 'ownership', 'whole-part', 'independent'],
    expected_content_summary:
      "Both represent 'has-a' relationships. In Composition, the child object's lifecycle is managed by the parent (if the parent dies, the child dies). In Aggregation, the child can exist independently of the parent.",
  },
  {
    id: 'q_014',
    category: 'L2_Comparison',
    query: 'What is the difference between Public, Private, and Protected access modifiers?',
    keywords: ['visibility', 'subclass', 'package', 'inheritance'],
    expected_content_summary:
      'Public is accessible by any code. Private is accessible only within the class itself. Protected is accessible by the class and its subclasses (and often classes in the same package), balancing encapsulation with inheritance.',
  },
  {
    id: 'q_015',
    category: 'L3_Concept',
    query: "Why is the 'Diamond Problem' an argument against Multiple Inheritance?",
    keywords: ['ambiguity', 'multiple inheritance', 'hierarchy', 'conflict'],
    expected_content_summary:
      'The Diamond Problem occurs when a class inherits from two classes that both inherit from the same superclass. If both parents override a method, the compiler cannot decide which version the child should inherit, causing ambiguity.',
  },
  {
    id: 'q_016',
    category: 'L1_Definition',
    query: 'What is the primary role of a Destructor (or Finalizer)?',
    keywords: ['cleanup', 'memory', 'resource', 'lifecycle'],
    expected_content_summary:
      'A destructor is a method called automatically when an object is destroyed or garbage collected. Its primary role is to perform cleanup tasks, such as releasing memory, closing file handles, or severing network connections.',
  },
  {
    id: 'q_017',
    category: 'L3_Concept',
    query: 'How does Exception Handling improve software robustness compared to error codes?',
    keywords: ['throw', 'catch', 'flow', 'ignore'],
    expected_content_summary:
      'Error codes can be ignored by the programmer, leading to unstable states. Exceptions force the program to handle errors (or crash explicitly), separating error-handling logic from the main business logic flow.',
  },
  {
    id: 'q_018',
    category: 'L3_Concept',
    query: "Explain the concept of 'Deep Copy' vs 'Shallow Copy'.",
    keywords: ['reference', 'clone', 'duplicate', 'pointer'],
    expected_content_summary:
      'A shallow copy duplicates the object\'s references, so both objects point to the same underlying data. A deep copy duplicates the actual data (objects) referenced, creating a completely independent clone.',
  },
  {
    id: 'q_019',
    category: 'L1_Definition',
    query: "What does the 'this' keyword represent inside a method?",
    keywords: ['current instance', 'self', 'reference', 'variable'],
    expected_content_summary:
      "The 'this' keyword refers to the current instance of the object executing the method. It is used to distinguish instance variables from local variables or parameters with the same name.",
  },
  {
    id: 'q_020',
    category: 'L2_Comparison',
    query: 'Why should you program to an Interface rather than an Implementation?',
    keywords: ['coupling', 'flexibility', 'dependency', 'swap'],
    expected_content_summary:
      'Programming to an interface decouples the code from specific classes. It allows you to swap out the underlying implementation (e.g., changing a database driver) without breaking the code that uses it.',
  },
  // group 3
  {
    id: 'q_021',
    category: 'L2_Comparison',
    query: 'Explain the relationship between Coupling and Cohesion.',
    keywords: ['dependency', 'responsibility', 'loose coupling', 'high cohesion'],
    expected_content_summary:
      'Good design strives for loose coupling (minimal dependencies between classes) and high cohesion (a class focuses on a single, well-defined purpose). They are inversely related: high cohesion often leads to looser coupling.',
  },
  {
    id: 'q_022',
    category: 'L1_Definition',
    query: 'What is Object Serialization?',
    keywords: ['stream', 'persist', 'network', 'state'],
    expected_content_summary:
      "Serialization is the process of converting an object's state into a byte stream (or format like JSON/XML) so it can be saved to a file (persistence) or transmitted over a network.",
  },
  {
    id: 'q_023',
    category: 'L3_Concept',
    query: "Why are Static Methods sometimes considered 'not purely object-oriented'?",
    keywords: ['class level', 'instance', 'global', 'polymorphism'],
    expected_content_summary:
      "Static methods belong to the class, not a specific instance. They cannot use 'this' and cannot be overridden in the same way as instance methods (no dynamic polymorphism), behaving more like global procedural functions.",
  },
  {
    id: 'q_024',
    category: 'L3_Concept',
    query: 'How does Garbage Collection manage memory in modern OO languages?',
    keywords: ['automatic', 'memory leak', 'reference', 'heap'],
    expected_content_summary:
      'Garbage Collection automatically reclaims memory occupied by objects that are no longer reachable (referenced) by the application, preventing common errors like manual memory leaks and dangling pointers.',
  },
  {
    id: 'q_025',
    category: 'L2_Comparison',
    query: 'What is the difference between an API and an Interface in a broader context?',
    keywords: ['library', 'contract', 'method signatures', 'access'],
    expected_content_summary:
      'In coding, an Interface is a specific language construct. Broadly, an API (Application Programming Interface) is the sum of all public methods and classes exposed by a library or service for external use.',
  },
  {
    id: 'q_026',
    category: 'L3_Concept',
    query: "Why is 'Code Duplication' considered a major anti-pattern in OO design?",
    keywords: ['maintenance', 'bug', 'inheritance', 'refactoring'],
    expected_content_summary:
      "Code duplication violates the DRY (Don't Repeat Yourself) principle. If logic is duplicated, fixing a bug requires changing code in multiple places, increasing maintenance effort and the risk of inconsistencies.",
  },
  {
    id: 'q_027',
    category: 'L1_Definition',
    query: 'What is the purpose of Namespaces (or Packages)?',
    keywords: ['organization', 'collision', 'naming', 'scope'],
    expected_content_summary:
      "Namespaces (or packages) organize classes into logical groups and prevent naming collisions, allowing two different libraries to use the same class name (e.g., 'Date') without conflict.",
  },
  {
    id: 'q_028',
    category: 'L3_Concept',
    query: 'How do Design Patterns assist in Object-Oriented Development?',
    keywords: ['reusable', 'solution', 'common problems', 'best practices'],
    expected_content_summary:
      'Design Patterns are proven, reusable solutions to common problems in software design (like Singleton, Factory, or Observer). They provide a shared vocabulary and best practices for developers.',
  },
  {
    id: 'q_029',
    category: 'L2_Comparison',
    query: 'Pass-by-Value vs Pass-by-Reference for Objects: What is the distinction?',
    keywords: ['copy', 'pointer', 'address', 'modification'],
    expected_content_summary:
      'When passing an object by reference, the method receives the memory address; changes affect the original object. When passing by value (primitive), a copy is made; changes do not affect the original.',
  },
  {
    id: 'q_030',
    category: 'L3_Concept',
    query: "What is the 'Contract' implied by a public interface?",
    keywords: ['promise', 'behavior', 'client', 'change'],
    expected_content_summary:
      'A public interface forms a contract or promise with the client code. The provider guarantees that the method signatures and expected behaviors will remain stable, allowing implementation details to change without breaking client code.',
  },
  // group 4
  {
    id: 'q_031',
    category: 'L3_Concept',
    query: "What is the 'Impedance Mismatch' between Object-Oriented programs and Relational Databases?",
    keywords: ['relational', 'database', 'mapping', 'table', 'mismatch'],
    expected_content_summary:
      'Impedance Mismatch refers to the conceptual and structural difficulties in mapping Objects (graph-based, encapsulating behavior and data) to Relational Tables (set-based, storing only data), often requiring an ORM (Object-Relational Mapping) layer.',
  },
  {
    id: 'q_032',
    category: 'L1_Definition',
    query: 'Explain the Single Responsibility Principle (SRP).',
    keywords: ['solid', 'responsibility', 'change', 'one reason'],
    expected_content_summary:
      'SRP states that a class should have only one reason to change, meaning it should encompass only a single responsibility or function within the software system.',
  },
  {
    id: 'q_033',
    category: 'L1_Definition',
    query: 'What does the Open/Closed Principle state regarding class design?',
    keywords: ['extension', 'modification', 'closed', 'open'],
    expected_content_summary:
      'The Open/Closed Principle states that software entities (classes, modules, functions) should be open for extension (adding new behavior) but closed for modification (changing existing code).',
  },
  {
    id: 'q_034',
    category: 'L2_Comparison',
    query: 'What is the difference between a Framework and a Class Library?',
    keywords: ['inversion of control', 'calls you', 'structure', 'flow'],
    expected_content_summary:
      "In a Library, your code calls the library's code. In a Framework, the relationship is inverted (Inversion of Control): the framework calls your code (via callbacks or overridden methods) and dictates the overall architecture.",
  },
  {
    id: 'q_035',
    category: 'L3_Concept',
    query: 'Why are Getters and Setters (Accessors and Mutators) preferred over public attributes?',
    keywords: ['validation', 'control', 'read-only', 'encapsulation'],
    expected_content_summary:
      'Getters and Setters allow the object to control access to its data. They enable validation logic (e.g., ensuring an age is not negative) and allow changing the internal representation without breaking the public interface.',
  },
  {
    id: 'q_036',
    category: 'L1_Definition',
    query: "What is the 'super' keyword used for in inheritance?",
    keywords: ['parent class', 'constructor', 'override', 'base'],
    expected_content_summary:
      "The 'super' keyword is used to access members (methods or constructors) of the immediate parent class (superclass), often used to invoke the parent's constructor or a method that has been overridden.",
  },
  {
    id: 'q_037',
    category: 'L2_Comparison',
    query: 'Compare XML vs JSON for object data exchange.',
    keywords: ['verbose', 'lightweight', 'schema', 'parsing'],
    expected_content_summary:
      'XML is more verbose and supports strict schemas/validation, making it suitable for complex document structures. JSON is lightweight, easier to parse, and maps more directly to object structures in languages like JavaScript.',
  },
  {
    id: 'q_038',
    category: 'L3_Concept',
    query: "What is the danger of creating 'God Objects' (or Kitchen Sink classes)?",
    keywords: ['anti-pattern', 'maintenance', 'bloated', 'responsibilities'],
    expected_content_summary:
      'A God Object is an anti-pattern where a single class knows too much or does too much. It violates high cohesion, making the code difficult to maintain, test, and split apart.',
  },
  {
    id: 'q_039',
    category: 'L2_Comparison',
    query: 'What is the difference between Association and Dependency in UML?',
    keywords: ['structural', 'temporary', 'reference', 'parameter'],
    expected_content_summary:
      'Association is a structural relationship where one object holds a reference to another (e.g., field). Dependency is a weaker, temporary relationship where one object uses another (e.g., as a parameter) but does not retain a relationship.',
  },
  {
    id: 'q_040',
    category: 'L3_Concept',
    query: "How does Polymorphism support the concept of 'Pluggability' in software?",
    keywords: ['driver', 'swap', 'interface', 'runtime'],
    expected_content_summary:
      'Polymorphism allows a system to interact with any object that implements a specific interface. This means new components (plugins, drivers) can be added or swapped at runtime without changing the core system code.',
  },
]

function findLatestDoc() {
  return db
    .prepare(
      `SELECT id, kb_id, user_id, file_name, chunk_count
       FROM documents
       WHERE status='completed' AND chunk_count>0
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .get() as { id: string; kb_id: string; user_id: string; file_name: string; chunk_count: number } | undefined
}

async function rerankLayer(query: string, items: any[], topN: number) {
  if (!USE_RERANK || items.length === 0) return items

  try {
    const { data } = await axios.post(
      RERANK_URL,
      {
        model: RERANK_MODEL,
        query,
        documents: items.map(item => item.payload.content),
        top_n: Math.min(topN, items.length),
      },
      {
        headers: {
          Authorization: `Bearer ${LITELLM_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: RERANK_TIMEOUT_MS,
      },
    )

    const scoreByIdx = new Map<number, number>()
    for (const entry of data?.data || []) {
      if (typeof entry.index === 'number' && typeof entry.relevance_score === 'number') {
        scoreByIdx.set(entry.index, entry.relevance_score)
      }
    }

    return items
      .map((item, idx) => ({
        ...item,
        rerankScore: scoreByIdx.get(idx) ?? item.score ?? 0,
      }))
      .sort((a, b) => (b.rerankScore ?? 0) - (a.rerankScore ?? 0))
      .slice(0, Math.min(topN, items.length))
  } catch (err) {
    console.warn(`[Rerank] 失败，使用原排序: ${err instanceof Error ? err.message : String(err)}`)
    return items
  }
}

async function main() {
  initializeDatabase()

  const doc = findLatestDoc()
  if (!doc) {
    console.error('未找到已处理的文档（status=completed 且 chunk_count>0）')
    process.exit(1)
  }

  console.log(`使用文档: ${doc.file_name} (docId=${doc.id}) kbId=${doc.kb_id} userId=${doc.user_id}`)

  const resultsSummary: Array<{
    id: string
    hit: boolean
    keywordHitRate: number
    totalResults?: number
    topLayer?: string
  }> = []

  for (const q of QUESTIONS) {
    const ragResult = await ragRetrieve(doc.user_id, q.query, {
      kbId: doc.kb_id,
      // 文档层在 skipKType 时不会生成 document chunk，明确限定当前文档避免第一层为空
      documentIds: [doc.id],
      // 放宽阈值并扩大候选池，提升召回覆盖率
      scoreThreshold: 0.15,
      documentLimit: 1,
      parentLimit: 6,
      childLimit: 16,
    })

    // rerank 统一取 top 8（父层不足则按实际数量返回）
    const RERANK_TOPN = 8
    const parents = await rerankLayer(q.query, ragResult.context.parents, RERANK_TOPN)
    const children = await rerankLayer(q.query, ragResult.context.children, RERANK_TOPN)

    const allTexts: string[] = []
    if (ragResult.context.document) allTexts.push(ragResult.context.document.payload.content)
    allTexts.push(...parents.map(p => p.payload.content))
    allTexts.push(...children.map(c => c.payload.content))

    const textCombined = allTexts.join(' ').toLowerCase()
    const matched = q.keywords.filter(kw => textCombined.includes(kw.toLowerCase()))
    const hitRate = matched.length / q.keywords.length

    const topLayer = ragResult.context.document
      ? 'document'
      : parents.length > 0
        ? 'parent'
        : children.length > 0
          ? 'child'
          : 'none'

    resultsSummary.push({
      id: q.id,
      hit: hitRate > 0,
      keywordHitRate: hitRate,
      totalResults: (ragResult.context.document ? 1 : 0) + parents.length + children.length,
      topLayer,
    })

    console.log(`\n[${q.id}] ${q.query}`)
    if (USE_RERANK) {
      console.log(`  rerank: on model=${RERANK_MODEL}`)
    }
    console.log(`  命中: ${hitRate > 0 ? 'YES' : 'NO '} 关键词覆盖: ${(hitRate * 100).toFixed(0)}%`)
    console.log(`  三层结果: doc=${ragResult.context.document ? 1 : 0}, parent=${parents.length}, child=${children.length}`)

    const sample =
      children[0]?.payload.content ||
      parents[0]?.payload.content ||
      ragResult.context.document?.payload.content

    if (sample) {
      console.log(`  摘要: ${sample.slice(0, 180).replace(/\\s+/g, ' ')}...`)
    } else {
      console.log('  未找到结果')
    }
  }

  const pass = resultsSummary.filter(r => r.hit).length
  console.log('\n============================')
  console.log(`总题目: ${resultsSummary.length}`)
  console.log(`命中题数: ${pass}`)
  console.log(`命中率: ${(pass / resultsSummary.length * 100).toFixed(1)}%`)
  console.log('============================')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
