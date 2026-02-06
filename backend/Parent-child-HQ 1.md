dependencies:
- current_identifier: null
  type: marketplace
  value:
    marketplace_plugin_unique_identifier: langgenius/notion_datasource:0.1.12@2855c4a7cffd3311118ebe70f095e546f99935e47f12c841123146f728534f55
    version: null
- current_identifier: null
  type: marketplace
  value:
    marketplace_plugin_unique_identifier: langgenius/google_drive:0.1.6@4bc0cf8f8979ebd7321b91506b4bc8f090b05b769b5d214f2da4ce4c04ce30bd
    version: null
- current_identifier: null
  type: marketplace
  value:
    marketplace_plugin_unique_identifier: langgenius/siliconflow:0.0.37@8a4c4aeaa7dbfef5c0c1d6239f6243b3fb784dfaa88ddca4df19046244bca08a
    version: null
- current_identifier: null
  type: marketplace
  value:
    marketplace_plugin_unique_identifier: langgenius/parentchild_chunker:0.0.7@ee9c253e7942436b4de0318200af97d98d094262f3c1a56edbe29dcb01fbc158
    version: null
- current_identifier: null
  type: marketplace
  value:
    marketplace_plugin_unique_identifier: langgenius/jina_datasource:0.0.5@75942f5bbde870ad28e0345ff5ebf54ebd3aec63f0e66344ef76b88cf06b85c3
    version: null
- current_identifier: null
  type: marketplace
  value:
    marketplace_plugin_unique_identifier: langgenius/firecrawl_datasource:0.2.5@d401faf8406ca001d1e13c44dacd577ecb15388d63cb1961ac7bac1de0261429
    version: null
- current_identifier: null
  type: package
  value:
    plugin_unique_identifier: langgenius/dify_extractor:0.0.6@8ad436fdbc96f3a33325b0a5baf310295b8345317933db49a20c2dabd0ffb977
    version: null
kind: rag_pipeline
rag_pipeline:
  description: ''
  icon: 📙
  icon_background: '#FFF4ED'
  icon_type: emoji
  icon_url: null
  name: Parent-child-HQ 1
version: 0.1.0
workflow:
  conversation_variables: []
  environment_variables: []
  features: {}
  graph:
    edges:
    - data:
        isInLoop: false
        sourceType: datasource
        targetType: variable-aggregator
      id: 1754023419266-source-1753346901505-target
      selected: false
      source: '1754023419266'
      sourceHandle: source
      target: '1753346901505'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInLoop: false
        sourceType: datasource
        targetType: variable-aggregator
      id: 1756442998557-source-1756442986174-target
      selected: false
      source: '1756442998557'
      sourceHandle: source
      target: '1756442986174'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInIteration: false
        isInLoop: false
        sourceType: variable-aggregator
        targetType: if-else
      id: 1756442986174-source-1756443014860-target
      selected: false
      source: '1756442986174'
      sourceHandle: source
      target: '1756443014860'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInLoop: false
        sourceType: datasource
        targetType: variable-aggregator
      id: 1750836380067-source-1756442986174-target
      selected: false
      source: '1750836380067'
      sourceHandle: source
      target: '1756442986174'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInLoop: false
        sourceType: if-else
        targetType: tool
      id: 1756443014860-true-1750836391776-target
      selected: false
      source: '1756443014860'
      sourceHandle: 'true'
      target: '1750836391776'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInLoop: false
        sourceType: if-else
        targetType: document-extractor
      id: 1756443014860-false-1753349228522-target
      selected: false
      source: '1756443014860'
      sourceHandle: 'false'
      target: '1753349228522'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInLoop: false
        sourceType: datasource
        targetType: variable-aggregator
      id: 1756896212061-source-1753346901505-target
      selected: false
      source: '1756896212061'
      sourceHandle: source
      target: '1753346901505'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInLoop: false
        sourceType: datasource
        targetType: variable-aggregator
      id: 1756907397615-source-1753346901505-target
      selected: false
      source: '1756907397615'
      sourceHandle: source
      target: '1753346901505'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInLoop: false
        sourceType: tool
        targetType: knowledge-index
      id: 1756972161593-source-1750836372241-target
      selected: false
      source: '1756972161593'
      sourceHandle: source
      target: '1750836372241'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInLoop: false
        sourceType: tool
        targetType: variable-aggregator
      id: 1750836391776-source-1753346901505-target
      selected: false
      source: '1750836391776'
      sourceHandle: source
      target: '1753346901505'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInLoop: false
        sourceType: document-extractor
        targetType: variable-aggregator
      id: 1753349228522-source-1753346901505-target
      selected: false
      source: '1753349228522'
      sourceHandle: source
      target: '1753346901505'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInLoop: false
        sourceType: variable-aggregator
        targetType: llm
      id: 1753346901505-source-1765444930058-target
      selected: false
      source: '1753346901505'
      sourceHandle: source
      target: '1765444930058'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInLoop: false
        sourceType: llm
        targetType: llm
      id: 1765444930058-source-17654449719760-target
      selected: false
      source: '1765444930058'
      sourceHandle: source
      target: '17654449719760'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInLoop: false
        sourceType: llm
        targetType: template-transform
      id: 17654449719760-source-1765452748725-target
      selected: false
      source: '17654449719760'
      sourceHandle: source
      target: '1765452748725'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInLoop: false
        sourceType: variable-aggregator
        targetType: llm
      id: 1753346901505-source-1765453786891-target
      selected: false
      source: '1753346901505'
      sourceHandle: source
      target: '1765453786891'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInLoop: false
        sourceType: template-transform
        targetType: llm
      id: 1765452748725-source-1765453786891-target
      selected: false
      source: '1765452748725'
      sourceHandle: source
      target: '1765453786891'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInIteration: false
        isInLoop: false
        sourceType: llm
        targetType: template-transform
      id: 1765453786891-source-1765717725469-target
      source: '1765453786891'
      sourceHandle: source
      target: '1765717725469'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInLoop: false
        sourceType: template-transform
        targetType: llm
      id: 1765717725469-source-17654540957380-target
      source: '1765717725469'
      sourceHandle: source
      target: '17654540957380'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInIteration: false
        isInLoop: false
        sourceType: llm
        targetType: template-transform
      id: 17654540957380-source-1765718289879-target
      source: '17654540957380'
      sourceHandle: source
      target: '1765718289879'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInLoop: false
        sourceType: variable-aggregator
        targetType: template-transform
      id: 1753346901505-source-1765718289879-target
      source: '1753346901505'
      sourceHandle: source
      target: '1765718289879'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInLoop: false
        sourceType: template-transform
        targetType: tool
      id: 1765718289879-source-1756972161593-target
      source: '1765718289879'
      sourceHandle: source
      target: '1756972161593'
      targetHandle: target
      type: custom
      zIndex: 0
    nodes:
    - data:
        chunk_structure: hierarchical_model
        embedding_model: BAAI/bge-m3
        embedding_model_provider: langgenius/siliconflow/siliconflow
        index_chunk_variable_selector:
        - '1756972161593'
        - result
        indexing_technique: high_quality
        keyword_number: 10
        retrieval_model:
          reranking_enable: true
          reranking_mode: reranking_model
          reranking_model:
            reranking_model_name: BAAI/bge-reranker-v2-m3
            reranking_provider_name: langgenius/siliconflow/siliconflow
          score_threshold: 0
          score_threshold_enabled: false
          search_method: hybrid_search
          top_k: 3
          weights:
            keyword_setting:
              keyword_weight: 0.3
            vector_setting:
              embedding_model_name: BAAI/bge-m3
              embedding_provider_name: langgenius/siliconflow/siliconflow
              vector_weight: 0.7
        selected: false
        title: Knowledge Base
        type: knowledge-index
      height: 113
      id: '1750836372241'
      position:
        x: 4553
        y: 458
      positionAbsolute:
        x: 4553
        y: 458
      selected: false
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 241
    - data:
        datasource_configurations: {}
        datasource_label: File
        datasource_name: upload-file
        datasource_parameters: {}
        fileExtensions:
        - txt
        - markdown
        - mdx
        - pdf
        - html
        - xlsx
        - xls
        - vtt
        - properties
        - doc
        - docx
        - csv
        - eml
        - msg
        - pptx
        - xml
        - epub
        - ppt
        - md
        plugin_id: langgenius/file
        provider_name: file
        provider_type: local_file
        selected: false
        title: File
        type: datasource
      height: 51
      id: '1750836380067'
      position:
        x: 0
        y: 44
      positionAbsolute:
        x: 0
        y: 44
      selected: false
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 241
    - data:
        is_team_authorization: true
        output_schema:
          properties:
            documents:
              description: the documents extracted from the file
              items:
                type: object
              type: array
            images:
              description: The images extracted from the file
              items:
                type: object
              type: array
          type: object
        paramSchemas:
        - auto_generate: null
          default: null
          form: llm
          human_description:
            en_US: the file to be parsed(support pdf, ppt, pptx, doc, docx, png, jpg,
              jpeg)
            ja_JP: the file to be parsed(support pdf, ppt, pptx, doc, docx, png, jpg,
              jpeg)
            pt_BR: o arquivo a ser analisado (suporta pdf, ppt, pptx, doc, docx, png,
              jpg, jpeg)
            zh_Hans: 用于解析的文件(支持 pdf, ppt, pptx, doc, docx, png, jpg, jpeg)
          label:
            en_US: file
            ja_JP: file
            pt_BR: file
            zh_Hans: file
          llm_description: the file to be parsed (support pdf, ppt, pptx, doc, docx,
            png, jpg, jpeg)
          max: null
          min: null
          name: file
          options: []
          placeholder: null
          precision: null
          required: true
          scope: null
          template: null
          type: file
        params:
          file: ''
        provider_id: langgenius/dify_extractor/dify_extractor
        provider_name: langgenius/dify_extractor/dify_extractor
        provider_type: builtin
        selected: false
        title: Dify Extractor
        tool_configurations: {}
        tool_description: Dify Extractor
        tool_label: Dify Extractor
        tool_name: dify_extractor
        tool_node_version: '2'
        tool_parameters:
          file:
            type: variable
            value:
            - '1756442986174'
            - output
        type: tool
      height: 51
      id: '1750836391776'
      position:
        x: 1063
        y: 188
      positionAbsolute:
        x: 1063
        y: 188
      selected: false
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 241
    - data:
        author: TenTen
        desc: ''
        height: 388
        selected: false
        showAuthor: true
        text: '{"root":{"children":[{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"Currently
          we support 4 types of ","type":"text","version":1},{"detail":0,"format":1,"mode":"normal","style":"","text":"Data
          Sources","type":"text","version":1},{"detail":0,"format":0,"mode":"normal","style":"","text":":
          File Upload, Online Drive, Online Doc, and Web Crawler. Different types
          of Data Sources have different input and output types. The output of File
          Upload and Online Drive are files, while the output of Online Doc and WebCrawler
          are pages. You can find more Data Sources on our Marketplace.","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1,"textFormat":0,"textStyle":""},{"children":[],"direction":null,"format":"","indent":0,"type":"paragraph","version":1,"textFormat":0,"textStyle":""},{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"A
          Knowledge Pipeline can have multiple data sources. Each data source can
          be selected more than once with different settings. Each added data source
          is a tab on the add file interface. However, each time the user can only
          select one data source to import the file and trigger its subsequent processing.","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1,"textFormat":0,"textStyle":""},{"children":[],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1,"textFormat":0,"textStyle":""}],"direction":"ltr","format":"","indent":0,"type":"root","version":1}}'
        theme: blue
        title: ''
        type: ''
        width: 285
      height: 388
      id: '1751252440357'
      position:
        x: -1723.9942193415582
        y: 224.87938381325645
      positionAbsolute:
        x: -1723.9942193415582
        y: 224.87938381325645
      selected: false
      sourcePosition: right
      targetPosition: left
      type: custom-note
      width: 285
    - data:
        output_type: string
        selected: false
        title: Variable Aggregator
        type: variable-aggregator
        variables:
        - - '1750836391776'
          - text
        - - '1753349228522'
          - text
        - - '1754023419266'
          - content
        - - '1756896212061'
          - content
        - - '1756907397615'
          - content
      height: 211
      id: '1753346901505'
      position:
        x: 1424
        y: 422
      positionAbsolute:
        x: 1424
        y: 422
      selected: false
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 241
    - data:
        is_array_file: false
        selected: false
        title: Doc Extractor
        type: document-extractor
        variable_selector:
        - '1756442986174'
        - output
      height: 103
      id: '1753349228522'
      position:
        x: 1063
        y: 319
      positionAbsolute:
        x: 1063
        y: 319
      selected: false
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 241
    - data:
        datasource_configurations: {}
        datasource_label: Notion
        datasource_name: notion_datasource
        datasource_parameters: {}
        plugin_id: langgenius/notion_datasource
        provider_name: notion_datasource
        provider_type: online_document
        selected: false
        title: Notion
        type: datasource
      height: 51
      id: '1754023419266'
      position:
        x: 1063
        y: 502
      positionAbsolute:
        x: 1063
        y: 502
      selected: false
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 241
    - data:
        output_type: file
        selected: false
        title: Variable Aggregator
        type: variable-aggregator
        variables:
        - - '1750836380067'
          - file
        - - '1756442998557'
          - file
      height: 133
      id: '1756442986174'
      position:
        x: 361
        y: 112
      positionAbsolute:
        x: 361
        y: 112
      selected: false
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 241
    - data:
        datasource_configurations: {}
        datasource_label: Google Drive
        datasource_name: google_drive
        datasource_parameters: {}
        plugin_id: langgenius/google_drive
        provider_name: google_drive
        provider_type: online_drive
        selected: false
        title: Google Drive
        type: datasource
      height: 51
      id: '1756442998557'
      position:
        x: 20
        y: 175
      positionAbsolute:
        x: 20
        y: 175
      selected: false
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 241
    - data:
        cases:
        - case_id: 'true'
          conditions:
          - comparison_operator: is
            id: 1581dd11-7898-41f4-962f-937283ba7e01
            value: .xlsx
            varType: string
            variable_selector:
            - '1756442986174'
            - output
            - extension
          - comparison_operator: is
            id: 92abb46d-d7e4-46e7-a5e1-8a29bb45d528
            value: .xls
            varType: string
            variable_selector:
            - '1756442986174'
            - output
            - extension
          - comparison_operator: is
            id: 1dde5ae7-754d-4e83-96b2-fe1f02995d8b
            value: .md
            varType: string
            variable_selector:
            - '1756442986174'
            - output
            - extension
          - comparison_operator: is
            id: 7e1a80e5-c32a-46a4-8f92-8912c64972aa
            value: .markdown
            varType: string
            variable_selector:
            - '1756442986174'
            - output
            - extension
          - comparison_operator: is
            id: 53abfe95-c7d0-4f63-ad37-17d425d25106
            value: .mdx
            varType: string
            variable_selector:
            - '1756442986174'
            - output
            - extension
          - comparison_operator: is
            id: 436877b8-8c0a-4cc6-9565-92754db08571
            value: .html
            varType: file
            variable_selector:
            - '1756442986174'
            - output
            - extension
          - comparison_operator: is
            id: 5e3e375e-750b-4204-8ac3-9a1174a5ab7c
            value: .htm
            varType: file
            variable_selector:
            - '1756442986174'
            - output
            - extension
          - comparison_operator: is
            id: 1a84a784-a797-4f96-98a0-33a9b48ceb2b
            value: .docx
            varType: file
            variable_selector:
            - '1756442986174'
            - output
            - extension
          - comparison_operator: is
            id: 62d11445-876a-493f-85d3-8fc020146bdd
            value: .csv
            varType: file
            variable_selector:
            - '1756442986174'
            - output
            - extension
          - comparison_operator: is
            id: 02c4bce8-7668-4ccd-b750-4281f314b231
            value: .txt
            varType: file
            variable_selector:
            - '1756442986174'
            - output
            - extension
          id: 'true'
          logical_operator: or
        selected: false
        title: IF/ELSE
        type: if-else
      height: 357
      id: '1756443014860'
      position:
        x: 702
        y: 0
      positionAbsolute:
        x: 702
        y: 0
      selected: false
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 241
    - data:
        datasource_configurations: {}
        datasource_label: Jina Reader
        datasource_name: jina_reader
        datasource_parameters:
          crawl_sub_pages:
            type: variable
            value:
            - rag
            - '1756896212061'
            - jina_subpages
          limit:
            type: variable
            value:
            - rag
            - '1756896212061'
            - jina_limit
          url:
            type: mixed
            value: '{{#rag.1756896212061.jina_url#}}'
          use_sitemap:
            type: variable
            value:
            - rag
            - '1756896212061'
            - jian_sitemap
        plugin_id: langgenius/jina_datasource
        provider_name: jinareader
        provider_type: website_crawl
        selected: false
        title: Jina Reader
        type: datasource
      height: 51
      id: '1756896212061'
      position:
        x: 1063
        y: 633
      positionAbsolute:
        x: 1063
        y: 633
      selected: false
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 241
    - data:
        datasource_configurations: {}
        datasource_label: Firecrawl
        datasource_name: crawl
        datasource_parameters:
          crawl_subpages:
            type: variable
            value:
            - rag
            - '1756907397615'
            - firecrawl_subpages
          exclude_paths:
            type: mixed
            value: '{{#rag.1756907397615.exclude_paths#}}'
          include_paths:
            type: mixed
            value: '{{#rag.1756907397615.include_paths#}}'
          limit:
            type: variable
            value:
            - rag
            - '1756907397615'
            - max_pages
          max_depth:
            type: variable
            value:
            - rag
            - '1756907397615'
            - max_depth
          only_main_content:
            type: variable
            value:
            - rag
            - '1756907397615'
            - main_content
          url:
            type: mixed
            value: '{{#rag.1756907397615.firecrawl_url1#}}'
        plugin_id: langgenius/firecrawl_datasource
        provider_name: firecrawl
        provider_type: website_crawl
        selected: false
        title: Firecrawl
        type: datasource
      height: 51
      id: '1756907397615'
      position:
        x: 1063
        y: 764
      positionAbsolute:
        x: 1063
        y: 764
      selected: false
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 241
    - data:
        is_team_authorization: true
        paramSchemas:
        - auto_generate: null
          default: null
          form: llm
          human_description:
            en_US: The text you want to chunk.
            ja_JP: The text you want to chunk.
            pt_BR: Conteúdo de Entrada
            zh_Hans: 输入文本
          label:
            en_US: Input Content
            ja_JP: Input Content
            pt_BR: Conteúdo de Entrada
            zh_Hans: 输入文本
          llm_description: The text you want to chunk.
          max: null
          min: null
          name: input_text
          options: []
          placeholder: null
          precision: null
          required: true
          scope: null
          template: null
          type: string
        - auto_generate: null
          default: paragraph
          form: llm
          human_description:
            en_US: Split text into paragraphs based on separator and maximum chunk
              length, using split text as parent block or entire document as parent
              block and directly retrieve.
            ja_JP: Split text into paragraphs based on separator and maximum chunk
              length, using split text as parent block or entire document as parent
              block and directly retrieve.
            pt_BR: Dividir texto em parágrafos com base no separador e no comprimento
              máximo do bloco, usando o texto dividido como bloco pai ou documento
              completo como bloco pai e diretamente recuperá-lo.
            zh_Hans: 根据分隔符和最大块长度将文本拆分为段落，使用拆分文本作为检索的父块或整个文档用作父块并直接检索。
          label:
            en_US: Parent Mode
            ja_JP: Parent Mode
            pt_BR: Modo Pai
            zh_Hans: 父块模式
          llm_description: Split text into paragraphs based on separator and maximum
            chunk length, using split text as parent block or entire document as parent
            block and directly retrieve.
          max: null
          min: null
          name: parent_mode
          options:
          - icon: ''
            label:
              en_US: paragraph
              ja_JP: paragraph
              pt_BR: paragraph
              zh_Hans: paragraph
            value: paragraph
          - icon: ''
            label:
              en_US: full_doc
              ja_JP: full_doc
              pt_BR: full_doc
              zh_Hans: full_doc
            value: full_doc
          placeholder: null
          precision: null
          required: true
          scope: null
          template: null
          type: select
        - auto_generate: null
          default: '


            '
          form: llm
          human_description:
            en_US: Separator used for chunking
            ja_JP: Separator used for chunking
            pt_BR: Separador usado para divisão
            zh_Hans: 用于分块的分隔符
          label:
            en_US: Parent Delimiter
            ja_JP: Parent Delimiter
            pt_BR: Separador de Pai
            zh_Hans: 父块分隔符
          llm_description: The separator used to split chunks
          max: null
          min: null
          name: separator
          options: []
          placeholder: null
          precision: null
          required: false
          scope: null
          template: null
          type: string
        - auto_generate: null
          default: 1024
          form: llm
          human_description:
            en_US: Maximum length for chunking
            ja_JP: Maximum length for chunking
            pt_BR: Comprimento máximo para divisão
            zh_Hans: 用于分块的最大长度
          label:
            en_US: Maximum Parent Chunk Length
            ja_JP: Maximum Parent Chunk Length
            pt_BR: Comprimento Máximo do Bloco Pai
            zh_Hans: 最大父块长度
          llm_description: Maximum length allowed per chunk
          max: null
          min: null
          name: max_length
          options: []
          placeholder: null
          precision: null
          required: false
          scope: null
          template: null
          type: number
        - auto_generate: null
          default: '. '
          form: llm
          human_description:
            en_US: Separator used for subchunking
            ja_JP: Separator used for subchunking
            pt_BR: Separador usado para subdivisão
            zh_Hans: 用于子分块的分隔符
          label:
            en_US: Child Delimiter
            ja_JP: Child Delimiter
            pt_BR: Separador de Subdivisão
            zh_Hans: 子分块分隔符
          llm_description: The separator used to split subchunks
          max: null
          min: null
          name: subchunk_separator
          options: []
          placeholder: null
          precision: null
          required: false
          scope: null
          template: null
          type: string
        - auto_generate: null
          default: 512
          form: llm
          human_description:
            en_US: Maximum length for subchunking
            ja_JP: Maximum length for subchunking
            pt_BR: Comprimento máximo para subdivisão
            zh_Hans: 用于子分块的最大长度
          label:
            en_US: Maximum Child Chunk Length
            ja_JP: Maximum Child Chunk Length
            pt_BR: Comprimento Máximo de Subdivisão
            zh_Hans: 子分块最大长度
          llm_description: Maximum length allowed per subchunk
          max: null
          min: null
          name: subchunk_max_length
          options: []
          placeholder: null
          precision: null
          required: false
          scope: null
          template: null
          type: number
        - auto_generate: null
          default: 0
          form: llm
          human_description:
            en_US: Whether to remove consecutive spaces, newlines and tabs
            ja_JP: Whether to remove consecutive spaces, newlines and tabs
            pt_BR: Se deve remover espaços extras no texto
            zh_Hans: 是否移除文本中的连续空格、换行符和制表符
          label:
            en_US: Replace consecutive spaces, newlines and tabs
            ja_JP: Replace consecutive spaces, newlines and tabs
            pt_BR: Substituir espaços consecutivos, novas linhas e guias
            zh_Hans: 替换连续空格、换行符和制表符
          llm_description: Whether to remove consecutive spaces, newlines and tabs
          max: null
          min: null
          name: remove_extra_spaces
          options: []
          placeholder: null
          precision: null
          required: false
          scope: null
          template: null
          type: boolean
        - auto_generate: null
          default: 0
          form: llm
          human_description:
            en_US: Whether to remove URLs and emails in the text
            ja_JP: Whether to remove URLs and emails in the text
            pt_BR: Se deve remover URLs e e-mails no texto
            zh_Hans: 是否移除文本中的URL和电子邮件地址
          label:
            en_US: Delete all URLs and email addresses
            ja_JP: Delete all URLs and email addresses
            pt_BR: Remover todas as URLs e e-mails
            zh_Hans: 删除所有URL和电子邮件地址
          llm_description: Whether to remove URLs and emails in the text
          max: null
          min: null
          name: remove_urls_emails
          options: []
          placeholder: null
          precision: null
          required: false
          scope: null
          template: null
          type: boolean
        params:
          input_text: ''
          max_length: ''
          parent_mode: ''
          remove_extra_spaces: ''
          remove_urls_emails: ''
          separator: ''
          subchunk_max_length: ''
          subchunk_separator: ''
        provider_id: langgenius/parentchild_chunker/parentchild_chunker
        provider_name: langgenius/parentchild_chunker/parentchild_chunker
        provider_type: builtin
        selected: false
        title: Parent-child Chunker
        tool_configurations: {}
        tool_description: Process documents into parent-child chunk structures
        tool_label: Parent-child Chunker
        tool_name: parentchild_chunker
        tool_node_version: '2'
        tool_parameters:
          input_text:
            type: mixed
            value: '{{#1765718289879.output#}}'
          max_length:
            type: variable
            value:
            - rag
            - shared
            - parent_length
          parent_mode:
            type: variable
            value:
            - rag
            - shared
            - parent_mode
          remove_extra_spaces:
            type: variable
            value:
            - rag
            - shared
            - clean_1
          remove_urls_emails:
            type: variable
            value:
            - rag
            - shared
            - clean_2
          separator:
            type: mixed
            value: '{{#rag.shared.parent_dilmiter#}}'
          subchunk_max_length:
            type: variable
            value:
            - rag
            - shared
            - child_length
          subchunk_separator:
            type: mixed
            value: '{{#rag.shared.child_delimiter#}}'
        type: tool
      height: 51
      id: '1756972161593'
      position:
        x: 4212
        y: 489
      positionAbsolute:
        x: 4212
        y: 489
      selected: true
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 241
    - data:
        context:
          enabled: false
          variable_selector: []
        model:
          completion_params:
            temperature: 0.3
          mode: chat
          name: Pro/deepseek-ai/DeepSeek-V3.2
          provider: langgenius/siliconflow/siliconflow
        prompt_template:
        - id: 7fcc3c42-db0a-4226-8a6b-b486f4ac81da
          role: system
          text: '# Role

            你是一位认知科学家和文本分析专家。你的任务是对用户提供的文本进行“三维度深度扫描”，提取其底层认知特征。

            # Theory Anchors (分析理论)

            1. **DIKW Pyramid**: 参考 Ackoff 的定义，分析文本是偏向 Data (原始符号)、Information (描述性回答)、Knowledge
            (如何做/规则) 还是 Wisdom (价值判断/伦理)。

            2. **Tacit vs Explicit**: 参考 Polanyi 的“个人知识”理论，区分显性编码知识 (Explicit/Codified)
            和无法言传的隐性体验/直觉 (Tacit/Personal)。

            3. **Reasoning Logic**: 参考 Chain-of-Thought (CoT)，识别文本的底层逻辑链条是时序、因果、层级还是网状。

            # Constraints

            - **不要**直接给出 K-Type 分类结论。

            - **不要**输出 JSON，请输出结构清晰的 Markdown 文本。

            - 必须引用原文片段作为证据。'
        - id: 5eabcd5c-283b-4100-a3fa-4b57e72561d5
          role: user
          text: '请分析以下【待分析文本】。

            【待分析文本】：{{#1753346901505.output#}}

            请严格按照以下三个维度生成扫描报告：

            ### 1. DIKW 密度分析

            - 判断内容层级并说明理由。

            ### 2. 显隐性平衡 (Tacit/Explicit)

            - 分析客观陈述与主观体验的比例。

            ### 3. 逻辑模式识别

            - 识别句子间的连接逻辑 (First/Then, Because/So, Is-a, Part-of)。'
        selected: false
        title: K type scan
        type: llm
        vision:
          enabled: false
      height: 87
      id: '1765444930058'
      position:
        x: 1785
        y: 431
      positionAbsolute:
        x: 1785
        y: 431
      selected: false
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 241
    - data:
        context:
          enabled: false
          variable_selector: []
        model:
          completion_params:
            enable_thinking: true
            temperature: 0.7
          mode: chat
          name: Pro/deepseek-ai/DeepSeek-V3.2
          provider: langgenius/siliconflow/siliconflow
        prompt_template:
        - id: 7fcc3c42-db0a-4226-8a6b-b486f4ac81da
          role: system
          text: '# Role

            你是一位精通定量分析的知识架构师。你的任务是根据“特征扫描报告”对文本的 K-Type（知识结构类型）进行**定量分类**。

            # Classification Rules (映射逻辑)

            请根据扫描报告中的特征，将文本映射到以下五类：

            1. **程序-行动型 (Procedural)**: 步骤/时序/How-to。

            2. **概念-分类型 (Conceptual)**: 定义/层级/What。

            3. **推理-因果型 (Reasoning)**: 原理/推导/Why。

            4. **系统-本体型 (Systemic)**: 交互/架构/Relation。

            5. **体验-叙事型 (Narrative)**: 隐性/感受/Personal。

            # Critical Constraints (关键约束)

            1. **必须输出数字**：你必须对每种类型分配一个具体的分数（例如：7/10）。

            2. **拒绝模糊描述**：严禁使用“主导”、“略高于”、“大部分”等文字描述权重，必须转化为数字。

            3. **基准评估**：

            对五种k-type进行**绝对价值评分 (Absolute Value Score)**：

            - **0-4分 (常识/噪音)**: 也就是你已经熟知的通用知识，或者是陈词滥调（例如：“要保持健康需要多运动”）。

            - **5-6分 (有效信息)**: 具体的、有上下文的事实或标准流程（Information）。

            - **7-8分 (独特知识)**: 反直觉的观点、专家的隐性经验、独特的具体案例或通过实证得出的深层逻辑（Knowledge）。

            - **9-10分 (智慧/洞察)**: 能够改变认知范式的深刻洞察、极具启发性的思维模型或极其罕见的各种高价值数据（Wisdom）。

            # Output Requirement

            请输出最终的裁决结果，必须包含精确的**权重分布分数**。'
        - id: 1e5cff24-91d4-4978-be4f-145cdc5b2de0
          role: user
          text: '这是一份针对某段文本的特征扫描报告，请阅读并做出分类裁决。

            【扫描报告】：{{#1765444930058.text#}}

            ---

            请严格按照以下格式输出最终结论（不要输出 JSON，直接输出 Markdown）：

            ### 最终 K-Type 判定

            **1. 绝对值评分**

            - 程序-行动型: [x/10]

            - 概念-分类型: [x/10]

            - 推理-因果型: [x/10]

            - 系统-本体型: [x/10]

            - 体验-叙事型: [x/10]

            **2. 主导类型:**

            [指出绝对值大于7分的类型]

            **3. 核心理由:**

            [基于报告证据的一句话理由]'
        selected: false
        title: K type classify
        type: llm
        vision:
          enabled: false
      height: 87
      id: '17654449719760'
      position:
        x: 2126
        y: 431
      positionAbsolute:
        x: 2126
        y: 431
      selected: false
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 241
    - data:
        selected: false
        template: "#  K-Type 深度分析报告\r\n\r\n---\r\n##  阶段二：架构师裁决 (Decision)\r\n{{ final_result\
          \ }}\r\n\r\n---\r\n##  阶段一：特征感知 (Sensing)\r\n> 以下是基于 DIKW 和 Polanyi 理论的深度扫描轨迹：\r\
          \n\r\n{{ scan_log }}\r\n\r\n---"
        title: k type report
        type: template-transform
        variables:
        - value_selector:
          - '1753346901505'
          - output
          value_type: string
          variable: raw
        - value_selector:
          - '1765444930058'
          - text
          value_type: string
          variable: scan_log
        - value_selector:
          - '17654449719760'
          - text
          value_type: string
          variable: final_result
      height: 51
      id: '1765452748725'
      position:
        x: 2467
        y: 449
      positionAbsolute:
        x: 2467
        y: 449
      selected: false
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 241
    - data:
        context:
          enabled: true
          variable_selector:
          - '1753346901505'
          - output
        model:
          completion_params:
            enable_thinking: true
            temperature: 0.3
          mode: chat
          name: Pro/deepseek-ai/DeepSeek-V3.2
          provider: langgenius/siliconflow/siliconflow
        prompt_template:
        - id: 85463d1f-3a3a-4f53-b50c-eab7420f527b
          role: system
          text: '# Role

            你是一位极为挑剔的**知识审计师**和**系统建模专家**。你的任务是评估输入文本的**绝对认知价值**，并仅对高价值内容进行建模。


            # The Benchmark (评估基准)

            请将【原始文本】中的信息与你作为大型语言模型（LLM）内部存储的**“通用知识库”**进行对比。

            不要关注某个观点在文章中出现的频率（权重），要关注它是否提供了**独特增量**。


            # Scoring Criteria (0-10 Scale)

            对以下五种 K-Type 进行**绝对价值评分 (Absolute Value Score)**：

            - **0-4分 (常识/噪音)**: 也就是你已经熟知的通用知识，或者是陈词滥调（例如：“要保持健康需要多运动”）。

            - **5-6分 (有效信息)**: 具体的、有上下文的事实或标准流程（Information）。

            - **7-8分 (独特知识)**: 反直觉的观点、专家的隐性经验、独特的具体案例或通过实证得出的深层逻辑（Knowledge）。

            - **9-10分 (智慧/洞察)**: 能够改变认知范式的深刻洞察、极具启发性的思维模型或极其罕见的各种高价值数据（Wisdom）。


            # Modeling Trigger (触发机制)

            **仅当**某个 K-Type 的得分 **>= 7分** 时，才为该类型生成独立的结构化模块。如果得分低于 7 分，忽略该类型，不要生成模块。


            # Modeling Strategy (按类型生成)

            对于触发的类型，请执行以下建模：

            1. **程序-行动型 (>=7)** -> 生成【高阶SOP/黑客技巧】：仅提取那些非显而易见的、专家级的操作细节。

            2. **概念-分类型 (>=7)** -> 生成【独家概念树】：仅提取文中定义的独特术语或新颖的分类框架。

            3. **推理-因果型 (>=7)** -> 生成【深度逻辑链】：还原那些复杂、反直觉或极其严密的论证过程。

            4. **系统-本体型 (>=7)** -> 生成【生态关系图】：描述文中独特的系统交互模式。

            5. **体验-叙事型 (>=7)** -> 生成【反思与心法】：提取那些带有强烈个人色彩、无法从教科书学到的隐性知识（Tacit Knowledge）。'
        - id: e1b65032-b115-402e-8ccc-7e744e43c621
          role: user
          text: '请审计以下内容，并生成高价值知识模型。

            【分析报告参考】：{{#1765452748725.output#}}

            【原始文本】：{{#1753346901505.output#}}

            ---

            ### 输出要求

            请严格按照以下 Markdown 格式输出（仅输出得分 >= 7 的模块）：


            ## 💎 高价值知识资产审计 (Value Audit)

            *(简要列出各类型的绝对评分及理由，例如：体验型 9分 - 包含了极其罕见的行业内幕)*


            ---

            ### 🧩 [模块名称] (认知增量分: X/10)

            **核心价值**: [一句话说明为什么这部分内容超出了通用常识]

            **结构化内容**:

            ...'
        selected: false
        title: LLM Auditor
        type: llm
        vision:
          enabled: false
      height: 87
      id: '1765453786891'
      position:
        x: 2828
        y: 462
      positionAbsolute:
        x: 2828
        y: 462
      selected: false
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 241
    - data:
        context:
          enabled: true
          variable_selector:
          - '1753346901505'
          - output
        model:
          completion_params:
            enable_thinking: true
            temperature: 0.3
          mode: chat
          name: Pro/deepseek-ai/DeepSeek-V3.2
          provider: langgenius/siliconflow/siliconflow
        prompt_template:
        - id: 85463d1f-3a3a-4f53-b50c-eab7420f527b
          role: system
          text: "# Role\n你是一位世界级的**知识资产设计师**和**内容策略专家**。你的核心能力是将抽象的“知识模型”转化为具体的、可复用的**“中间包\
            \ (Intermediate Packets)”**。\n\n# Objective\n基于输入的【高价值知识模型】，为用户生成一份**“拿来即用”**的行动资产。\n\
            \n# Transformation Rules (转化逻辑映射)\n请识别输入内容的主导类型，并按以下逻辑进行转化（仅选择最匹配的一种形式）：\n\
            \n1. **若输入为 [程序-行动型] (Procedural)**\n   - **转化目标**: 避免错误的**标准作业程序 (SOP)**\
            \ 或 **核对清单 (Checklist)**。\n   - **格式**: [ ] 动词 + 宾语（例如：[ ] 备份数据库）。\n\n\
            2. **若输入为 [概念-分类型] (Conceptual)**\n   - **转化目标**: **思维模型卡片 (Mental Model\
            \ Card)**。\n   - **格式**: \n     - **模型名称**: ...\n     - **核心定义**: (一句话解释)\n\
            \     - **适用场景**: (何时使用)\n     - **误区警示**: (不要用于哪里)\n\n3. **若输入为 [推理-因果型]\
            \ (Reasoning)**\n   - **转化目标**: **决策备忘录 (Decision Memo)** 或 **事前验尸报告 (Premortem)**。\n\
            \   - **格式**: \"为了实现X结果，必须满足Y条件，否则会导致Z后果。\"\n\n4. **若输入为 [系统-本体型] (Systemic)**\n\
            \   - **转化目标**: **系统回路描述 (System Loop)**。\n   - **格式**: text-based mermaid\
            \ code (如适用) 或 文字描述组件间的正/负反馈循环。\n\n5. **若输入为 [体验-叙事型] (Narrative)**\n\
            \   - **转化目标**: **金句与故事脚本 (Quote & Script)**。\n   - **格式**: 适合发在社交媒体上的短文，包含情感钩子和核心洞察。\n\
            \n# Constraints\n- **行动导向**: 输出必须是“动词”驱动的，或者是能直接辅助决策的。\n- **去学术化**: 不要使用晦涩的学术语言，要使用“人话”。\n\
            - **独立性**: 生成的内容必须能脱离原文独立存在（Self-contained）。\n- **不能遗漏**:必须转化输出所有报告中提到的模块。"
        - id: e1b65032-b115-402e-8ccc-7e744e43c621
          role: user
          text: '请将以下经过审计的高价值知识模型，转化为可复用的中间包（Intermediate Packet）。


            【高价值模型输入】：{{#1765717725469.output#}}

            ---

            请直接输出转化后的资产内容：




            '
        selected: false
        title: LLM Creator
        type: llm
        vision:
          enabled: false
      height: 87
      id: '17654540957380'
      position:
        x: 3510
        y: 462
      positionAbsolute:
        x: 3510
        y: 462
      selected: false
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 241
    - data:
        selected: false
        template: "# \U0001F9E0 CODE-DIKW 深度知识资产\r\n\r\n> 本报告仅收录了超出 LLM 通用认知基准的**高价值增量信息**。\r\
          \n\r\n{{value_model}}\r\n\r\n---\r\n*Generated by Dify / Knowledge Filter:\
          \ Absolute Value > 7.0*"
        title: Asset Assembler
        type: template-transform
        variables:
        - value_selector:
          - '1765453786891'
          - text
          value_type: string
          variable: value_model
      height: 51
      id: '1765717725469'
      position:
        x: 3169
        y: 480
      positionAbsolute:
        x: 3169
        y: 480
      selected: false
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 241
    - data:
        selected: false
        template: "# \U0001F9E0 CODE-DIKW 深度知识解构报告\r\n\r\n> **执行摘要**: 本报告对原始文本进行了\
          \ DIKW 降噪、ReAct 逻辑扫描与 MBSE 结构化建模，最终提炼出高价值的行动资产。\r\n\r\n---\r\n## \U0001F680\
          \ 核心产出：中间包 (Actionable Asset)\r\n*(这是你可以直接拿去使用的部分)*\r\n\r\n{{action_packet}}\r\
          \n\r\n---\r\n## \U0001F48E 认知增量审计 (Value Audit)\r\n*(这是超出大模型基准的高价值信息增量)*\r\
          \n\r\n{{value_model}}\r\n\r\n---\r\n## \U0001F50D 深度扫描轨迹 (Deep Scan Trace)\r\
          \n*(这是对文本逻辑与隐性知识的分析)*\r\n\r\n{{scan_log}}\r\n\r\n---\r\n## \U0001F4C2 附录：捕获摘要\
          \ (Curated Capture)\r\n*(这是去噪后的精华摘要)*\r\n\r\n{{capture_log}}\r\n\r\n---\r\
          \n## 原文 (raw)\r\n\r\n{{raw_text}}"
        title: Assembler
        type: template-transform
        variables:
        - value_selector:
          - '1753346901505'
          - output
          value_type: string
          variable: raw_text
        - value_selector:
          - '1765444930058'
          - text
          value_type: string
          variable: capture_log
        - value_selector:
          - '17654449719760'
          - text
          value_type: string
          variable: scan_log
        - value_selector:
          - '1765453786891'
          - text
          value_type: string
          variable: value_model
        - value_selector:
          - '17654540957380'
          - text
          value_type: string
          variable: action_packet
      height: 51
      id: '1765718289879'
      position:
        x: 3773.857142857142
        y: 697.5714285714286
      positionAbsolute:
        x: 3773.857142857142
        y: 697.5714285714286
      selected: false
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 241
    viewport:
      x: -2729.95
      y: 71.35000000000002
      zoom: 0.7
  rag_pipeline_variables:
  - allow_file_extension: null
    allow_file_upload_methods: null
    allowed_file_types: null
    belong_to_node_id: '1753688365254'
    default_value: null
    label: URL
    max_length: 256
    options: []
    placeholder: null
    required: true
    tooltips: null
    type: text-input
    unit: null
    variable: jina_reader_url
  - allow_file_extension: null
    allow_file_upload_methods: null
    allowed_file_types: null
    belong_to_node_id: '1753688365254'
    default_value: 10
    label: Limit
    max_length: 48
    options: []
    placeholder: null
    required: true
    tooltips: null
    type: number
    unit: pages
    variable: jina_reader_imit
  - allow_file_extension: null
    allow_file_upload_methods: null
    allowed_file_types: null
    belong_to_node_id: '1753688365254'
    default_value: true
    label: Crawl sub-pages
    max_length: 48
    options: []
    placeholder: null
    required: true
    tooltips: null
    type: checkbox
    unit: null
    variable: Crawl_sub_pages_2
  - allow_file_extension: null
    allow_file_upload_methods: null
    allowed_file_types: null
    belong_to_node_id: '1753688365254'
    default_value: true
    label: Use sitemap
    max_length: 48
    options: []
    placeholder: null
    required: false
    tooltips: null
    type: checkbox
    unit: null
    variable: Use_sitemap
  - allow_file_extension: null
    allow_file_upload_methods: null
    allowed_file_types: null
    belong_to_node_id: '1756896212061'
    default_value: null
    label: URL
    max_length: 256
    options: []
    placeholder: null
    required: true
    tooltips: null
    type: text-input
    unit: null
    variable: jina_url
  - allow_file_extension: null
    allow_file_upload_methods: null
    allowed_file_types: null
    belong_to_node_id: '1756896212061'
    default_value: 10
    label: Limit
    max_length: 48
    options: []
    placeholder: null
    required: true
    tooltips: null
    type: number
    unit: pages
    variable: jina_limit
  - allow_file_extension: null
    allow_file_upload_methods: null
    allowed_file_types: null
    belong_to_node_id: '1756896212061'
    default_value: true
    label: Use sitemap
    max_length: 48
    options: []
    placeholder: null
    required: false
    tooltips: Follow the sitemap to crawl the site. If not, Jina Reader will crawl
      iteratively based on page relevance, yielding fewer but higher-quality pages.
    type: checkbox
    unit: null
    variable: jian_sitemap
  - allow_file_extension: null
    allow_file_upload_methods: null
    allowed_file_types: null
    belong_to_node_id: '1756896212061'
    default_value: true
    label: Crawl subpages
    max_length: 48
    options: []
    placeholder: null
    required: false
    tooltips: null
    type: checkbox
    unit: null
    variable: jina_subpages
  - allow_file_extension: null
    allow_file_upload_methods: null
    allowed_file_types: null
    belong_to_node_id: '1756907397615'
    default_value: null
    label: URL
    max_length: 256
    options: []
    placeholder: null
    required: true
    tooltips: null
    type: text-input
    unit: null
    variable: firecrawl_url1
  - allow_file_extension: null
    allow_file_upload_methods: null
    allowed_file_types: null
    belong_to_node_id: '1756907397615'
    default_value: true
    label: firecrawl_subpages
    max_length: 48
    options: []
    placeholder: null
    required: false
    tooltips: null
    type: checkbox
    unit: null
    variable: firecrawl_subpages
  - allow_file_extension: null
    allow_file_upload_methods: null
    allowed_file_types: null
    belong_to_node_id: '1756907397615'
    default_value: null
    label: Exclude paths
    max_length: 256
    options: []
    placeholder: blog/*,/about/*
    required: false
    tooltips: null
    type: text-input
    unit: null
    variable: exclude_paths
  - allow_file_extension: null
    allow_file_upload_methods: null
    allowed_file_types: null
    belong_to_node_id: '1756907397615'
    default_value: null
    label: include_paths
    max_length: 256
    options: []
    placeholder: articles/*
    required: false
    tooltips: null
    type: text-input
    unit: null
    variable: include_paths
  - allow_file_extension: null
    allow_file_upload_methods: null
    allowed_file_types: null
    belong_to_node_id: '1756907397615'
    default_value: 0
    label: Max depth
    max_length: 48
    options: []
    placeholder: null
    required: false
    tooltips: Maximum depth to crawl relative to the entered URL. Depth 0 just scrapes
      the page of the entered url, depth 1 scrapes the url and everything after enteredURL
      + one /, and so on.
    type: number
    unit: null
    variable: max_depth
  - allow_file_extension: null
    allow_file_upload_methods: null
    allowed_file_types: null
    belong_to_node_id: '1756907397615'
    default_value: 10
    label: Limit
    max_length: 48
    options: []
    placeholder: null
    required: true
    tooltips: null
    type: number
    unit: null
    variable: max_pages
  - allow_file_extension: null
    allow_file_upload_methods: null
    allowed_file_types: null
    belong_to_node_id: '1756907397615'
    default_value: true
    label: Extract only main content (no headers, navs, footers, etc.)
    max_length: 48
    options: []
    placeholder: null
    required: false
    tooltips: null
    type: checkbox
    unit: null
    variable: main_content
  - allow_file_extension: null
    allow_file_upload_methods: null
    allowed_file_types: null
    belong_to_node_id: shared
    default_value: paragraph
    label: Parent Mode
    max_length: 48
    options:
    - paragraph
    - full_doc
    placeholder: null
    required: true
    tooltips: 'Parent Mode provides two options: paragraph mode splits text into paragraphs
      as parent chunks for retrieval, while full_doc mode uses the entire document
      as a single parent chunk (text beyond 10,000 tokens will be truncated).'
    type: select
    unit: null
    variable: parent_mode
  - allow_file_extension: null
    allow_file_upload_methods: null
    allowed_file_types: null
    belong_to_node_id: shared
    default_value: \n\n
    label: Parent Delimiter
    max_length: 48
    options: []
    placeholder: null
    required: false
    tooltips: A delimiter is the character used to separate text. \n\n is recommended
      for splitting the original document into large parent chunks. You can also use
      special delimiters defined by yourself.
    type: text-input
    unit: null
    variable: parent_dilmiter
  - allow_file_extension: null
    allow_file_upload_methods: null
    allowed_file_types: null
    belong_to_node_id: shared
    default_value: 1024
    label: Maximum Parent Length
    max_length: 48
    options: []
    placeholder: null
    required: false
    tooltips: null
    type: number
    unit: tokens
    variable: parent_length
  - allow_file_extension: null
    allow_file_upload_methods: null
    allowed_file_types: null
    belong_to_node_id: shared
    default_value: \n
    label: Child Delimiter
    max_length: 48
    options: []
    placeholder: null
    required: true
    tooltips: A delimiter is the character used to separate text. \n is recommended
      for splitting parent chunks into small child chunks. You can also use special
      delimiters defined by yourself.
    type: text-input
    unit: null
    variable: child_delimiter
  - allow_file_extension: null
    allow_file_upload_methods: null
    allowed_file_types: null
    belong_to_node_id: shared
    default_value: 256
    label: Maximum Child Length
    max_length: 48
    options: []
    placeholder: null
    required: true
    tooltips: null
    type: number
    unit: tokens
    variable: child_length
  - allow_file_extension: null
    allow_file_upload_methods: null
    allowed_file_types: null
    belong_to_node_id: shared
    default_value: true
    label: Replace consecutive spaces, newlines and tabs.
    max_length: 48
    options: []
    placeholder: null
    required: false
    tooltips: null
    type: checkbox
    unit: null
    variable: clean_1
  - allow_file_extension: null
    allow_file_upload_methods: null
    allowed_file_types: null
    belong_to_node_id: shared
    default_value: null
    label: Delete all URLs and email addresses.
    max_length: 48
    options: []
    placeholder: null
    required: false
    tooltips: null
    type: checkbox
    unit: null
    variable: clean_2
