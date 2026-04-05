;; Aski v0.9 — syntax highlighting queries
;; Modeled after tree-sitter-rust's highlights.scm for deep highlighting.

;; =============================================================
;; Comments
;; =============================================================

(comment) @comment

;; =============================================================
;; Literals
;; =============================================================

(integer_literal) @number
(float_literal) @number.float
(string_literal) @string
(string_content) @string
(string_escape) @string.escape
(string_interpolation) @string.special
(string_inline_eval "[" @string.escape)
(string_inline_eval "]" @string.escape)
(boolean_literal) @constant.builtin

;; =============================================================
;; Stub placeholder
;; =============================================================

(stub) @error

;; =============================================================
;; Instance references: @Name
;; =============================================================

(self_ref) @variable.builtin
(instance_ref "@" @punctuation.special)
(instance_ref) @variable

;; Parameters — override with .parameter
(param (instance_ref) @variable.parameter)
(param (borrow_ref (instance_ref) @variable.parameter))
(param (mutable_borrow_ref (instance_ref) @variable.parameter))

;; Legacy binding declarations
(binding_decl name: (instance_ref) @variable)
(binding_init (instance_ref) @variable)

;; v0.8: same-type binding
(same_type_new name: (instance_ref) @variable)

;; v0.8: sub-type binding
(sub_type_new name: (instance_ref) @variable)

;; v0.8: mutable binding
(mutable_new name: (instance_ref) @variable)
(mutable_new "~" @punctuation.special)

;; v0.8: mutable set
(mutable_set name: (instance_ref) @variable)
(mutable_set "~" @punctuation.special)

;; v0.8: sub-type declaration (no @)
(sub_type_decl name: (type_identifier) @variable)

;; =============================================================
;; Borrow / mutable borrow symbols
;; =============================================================

(borrow_ref ":" @punctuation.special)
(mutable_borrow_ref "~" @punctuation.special)

;; =============================================================
;; Constants
;; =============================================================

(const_ref "!" @punctuation.special)
(const_ref) @constant

(const_decl "!" @punctuation.special)
(const_decl name: (_) @constant)

;; =============================================================
;; Type definitions
;; =============================================================

;; Domain declaration
(domain_decl name: (type_identifier) @type.definition)

;; Struct declaration
(struct_decl name: (type_identifier) @type.definition)

;; Struct fields
(struct_field name: (type_identifier) @property)
(struct_field type: (type_identifier) @type)

;; Type alias
(type_alias name: (type_identifier) @type.definition)

;; Refinement type
(refinement_type name: (type_identifier) @type.definition)

;; =============================================================
;; Domain variants / constructors
;; =============================================================

(variant (type_identifier) @constructor)

;; Match arm patterns — inline (| |) variants
(match_arm_pattern (type_identifier) @constructor)

;; v0.8: commit arm patterns
(commit_arm (type_identifier) @constructor)

;; v0.8: backtrack arm patterns
(backtrack_arm (type_identifier) @constructor)

;; v0.9: destructure arm patterns
(destructure_arm (type_identifier) @constructor)

;; =============================================================
;; Built-in types
;; =============================================================

((type_identifier) @type.builtin
  (#any-of? @type.builtin
    "U8" "U16" "U32" "U64" "U128"
    "I8" "I16" "I32" "I64" "I128"
    "F32" "F64"
    "Bool" "String" "Self"
    "Vec" "Map" "Option" "Result"
    "Iterator" "Pair" "Triple"
    "Degree" "Orb"))

;; Self type
(self_type) @type.builtin

;; =============================================================
;; Type expressions
;; =============================================================

(generic_type (type_identifier) @type)
(borrow_type ":" @punctuation.special)

;; Trait bound type: {display}
(trait_bound_type "{" @punctuation.bracket)
(trait_bound_type "}" @punctuation.bracket)
(trait_bound (identifier) @type.interface)
(trait_bound "&" @punctuation.special)

;; =============================================================
;; Methods (v0.8: no free functions)
;; =============================================================

;; Trait method signatures
(trait_method_sig name: (identifier) @function)
(trait_method_default name: (identifier) @function)

;; Impl methods
(impl_member name: (identifier) @function)

;; Method access (camelCase after .)
(access_expr (_) @function.method
  (#match? @function.method "^[a-z]"))

;; Method call
(method_call_expr (_) @function.method.call
  (#match? @function.method.call "^[a-z]"))

;; Field access (PascalCase after .)
(access_expr (_) @property
  (#match? @property "^[A-Z]"))
(method_call_expr (_) @property
  (#match? @property "^[A-Z]"))

;; =============================================================
;; Trait declarations — trait names are camelCase verbs
;; =============================================================

(trait_decl name: (identifier) @type.interface)

;; Supertraits (identifiers inside trait_decl before trait_body)
(trait_decl (identifier) @type.interface)

;; =============================================================
;; Trait impl
;; =============================================================

(trait_impl trait_name: (identifier) @type.interface)
(trait_impl for_type: (type_identifier) @type)

;; =============================================================
;; Grammar rules
;; =============================================================

(grammar_rule "<" @punctuation.special)
(grammar_rule ">" @punctuation.special)
(grammar_rule (type_identifier) @type.definition)

(grammar_ref "<" @punctuation.special)
(grammar_ref ">" @punctuation.special)
(grammar_ref (type_identifier) @type)

;; =============================================================
;; Module
;; =============================================================

(module_decl name: (type_identifier) @module)

;; =============================================================
;; Main
;; =============================================================

(main_block "Main" @function.builtin)

;; =============================================================
;; Singleton calls
;; =============================================================

(stdout_expr "StdOut" @function.builtin)
(stderr_expr "StdErr" @function.builtin)

;; =============================================================
;; Struct construction
;; =============================================================

(struct_construction (type_identifier) @type)
(struct_construction_arg (type_identifier) @property)

;; =============================================================
;; Collection construction
;; =============================================================

(collection_construction (type_identifier) @type.builtin)

;; =============================================================
;; Return / Yield
;; =============================================================

(return_expr "^" @keyword.return)
(yield_expr "#" @keyword.yield)

;; =============================================================
;; Match / dispatch delimiters
;; =============================================================

;; Inline match (| |)
(match_expr "(|" @keyword.control)
(match_expr "|)" @keyword.control)
;; v0.8: matching method body (| |)
(matching_body "(|" @keyword.control)
(matching_body "|)" @keyword.control)

;; Match arm or-patterns
(match_arm_pattern "|" @punctuation.delimiter)

;; =============================================================
;; Operators
;; =============================================================

(binary_expr "+" @operator)
(binary_expr "-" @operator)
(binary_expr "*" @operator)
(binary_expr "/" @operator)
(binary_expr "%" @operator)
(binary_expr "==" @operator.comparison)
(binary_expr "!=" @operator.comparison)
(binary_expr "<" @operator.comparison)
(binary_expr ">" @operator.comparison)
(binary_expr "<=" @operator.comparison)
(binary_expr ">=" @operator.comparison)
(binary_expr "&&" @operator.logical)
(binary_expr "||" @operator.logical)

;; Range
(range_expr ".." @operator)
(range_expr "..=" @operator)

;; Error propagation
(error_propagation_expr "?" @punctuation.special)

;; Contracts removed — # is now yield

;; =============================================================
;; Pub
;; =============================================================

(pub_decl "Pub" @keyword)

;; =============================================================
;; Labels / lifetimes
;; =============================================================

(label "'" @label)
(label (identifier) @label)

;; =============================================================
;; Generic params
;; =============================================================

(generic_params) @punctuation.bracket

;; =============================================================
;; Punctuation — delimiters
;; =============================================================

(function_body "[" @punctuation.bracket)
(function_body "]" @punctuation.bracket)
(matching_body "(|" @punctuation.bracket)
(matching_body "|)" @punctuation.bracket)
(param_list "(" @punctuation.bracket)
(param_list ")" @punctuation.bracket)
(trait_body "[" @punctuation.bracket)
(trait_body "]" @punctuation.bracket)
(inline_eval "[" @punctuation.bracket)
(inline_eval "]" @punctuation.bracket)
;; closure removed — no closures in aski (section 19)
(paren_expr "(" @punctuation.bracket)
(paren_expr ")" @punctuation.bracket)
(collection_construction "[" @punctuation.bracket)
(collection_construction "]" @punctuation.bracket)

;; Dot access
"." @punctuation.delimiter

;; Wildcard
(wildcard) @variable.builtin
