;; Aski v0.17 — syntax highlighting queries

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


;; =============================================================
;; Built-in types
;; =============================================================

((type_identifier) @type.builtin
  (#any-of? @type.builtin
    "U8" "U16" "U32" "U64" "U128"
    "I8" "I16" "I32" "I64" "I128"
    "F32" "F64" "Bool" "String"
    "Vec" "Map" "Option" "Result"
    "Iterator" "Pair" "Triple"))


;; =============================================================
;; Built-in functions / IO
;; =============================================================

(stdout_stmt "StdOut" @function.builtin)
(stderr_stmt "StdErr" @function.builtin)


;; =============================================================
;; Sigils — @ : ~ $ ^ ?
;; =============================================================

(instance_ref "@" @keyword)
(self_ref) @variable.builtin
(borrow_ref ":" @keyword)
(mutable_ref "~" @keyword)
(generic_param "$" @keyword)
(generic_param "&" @keyword)
(early_return "^" @keyword.return)
(try_expr "?" @keyword)


;; =============================================================
;; Path — Type/Variant, Type/method(args)
;; =============================================================

(path_expr "/" @punctuation.delimiter)


;; =============================================================
;; Definitions — domains, structs, traits, modules
;; =============================================================

;; Module name
(module_decl
  name: (type_identifier) @module.definition)

;; Enum name
(enum_decl
  name: (type_identifier) @type.definition)

;; Struct name
(struct_decl
  name: (type_identifier) @type.definition)

;; Newtype name
(newtype_decl
  name: (type_identifier) @type.definition)

;; Const name
(const_decl
  name: (type_identifier) @constant)

;; Trait name (declaration)
(trait_decl
  name: (identifier) @type.interface)

;; Trait name (implementation)
(trait_impl
  trait_name: (identifier) @type.interface)

;; Trait impl target type
(trait_impl
  for_type: (type_identifier) @type)


;; =============================================================
;; Variants — enum members
;; =============================================================

(bare_variant (type_identifier) @constant)
(data_variant name: (type_identifier) @constant)
(struct_variant name: (type_identifier) @constant)
(nested_enum name: (type_identifier) @type.definition)
(nested_struct name: (type_identifier) @type.definition)


;; =============================================================
;; Struct fields
;; =============================================================

(typed_field name: (type_identifier) @property)
(self_typed_field (type_identifier) @property)


;; =============================================================
;; Methods and signatures
;; =============================================================

;; Method definition name
(method_def
  name: (identifier) @function.method)

;; Signature method name
(signature
  name: (identifier) @function.method)

;; Method call
(method_call
  . (_)
  . (_) @function.method.call)

;; Field access
(field_access
  . (_)
  . (_) @property)


;; =============================================================
;; Patterns
;; =============================================================

(variant_pattern (type_identifier) @constant)
(or_pattern (type_identifier) @constant)
(or_pattern "|" @keyword)
(destructure_pattern (type_identifier) @constant)


;; =============================================================
;; Module exports and imports
;; =============================================================

;; Exports — PascalCase types, camelCase traits
(module_export (type_identifier) @type)
(module_export (identifier) @type.interface)

;; Imports
(module_import (type_identifier) @module)


;; =============================================================
;; FFI
;; =============================================================

(ffi_block
  name: (type_identifier) @module)
(ffi_function
  name: (identifier) @function)


;; =============================================================
;; Parameters
;; =============================================================

(param (instance_ref) @variable.parameter)
(sig_param (instance_ref) @variable.parameter)
(ffi_param (instance_ref) @variable.parameter)


;; =============================================================
;; Generic fallbacks (MUST be last — first-match-wins)
;; =============================================================

(type_identifier) @type
(generic_param) @type.parameter


;; =============================================================
;; Instances / variables
;; =============================================================

;; Specific definitions first (first-match-wins)
(instance_stmt (instance_ref) @variable.definition)
(mutation_stmt (mutable_ref) @variable.definition)
;; Generic fallback
(instance_ref) @variable


;; =============================================================
;; Operators
;; =============================================================

(binary_expr "+" @operator)
(binary_expr "-" @operator)
(binary_expr "*" @operator)
(binary_expr "%" @operator)
(binary_expr "==" @operator)
(binary_expr "!=" @operator)
(binary_expr "<" @operator)
(binary_expr ">" @operator)
(binary_expr "<=" @operator)
(binary_expr ">=" @operator)
(binary_expr "&&" @operator)
(binary_expr "||" @operator)


;; =============================================================
;; Delimiters and punctuation
;; =============================================================

["(" ")" "[" "]" "{" "}"] @punctuation.bracket
["(|" "|)" "{|" "|}" "[|" "|]"] @punctuation.special
"." @punctuation.delimiter
