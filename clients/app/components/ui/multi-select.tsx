"use client"

import * as React from "react"
import type { ReactNode } from "react"
import { ChevronsUpDownIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

/**
 * MultiSelect — a single/multi select built on the project's Base UI Popover
 * and cmdk Command primitives.
 *
 *   <MultiSelect values={values} onValuesChange={setValues}>
 *     <MultiSelectTrigger>
 *       <MultiSelectValue placeholder="Pick options" />
 *     </MultiSelectTrigger>
 *     <MultiSelectContent search>
 *       <MultiSelectGroup heading="Group">
 *         <MultiSelectItem value="a">Option A</MultiSelectItem>
 *       </MultiSelectGroup>
 *     </MultiSelectContent>
 *   </MultiSelect>
 *
 * `values`/`onValuesChange` are fully controlled. Pass `single` to make
 * selecting an option replace the current value and close the dropdown.
 * `MultiSelectContent`'s `search` prop (default `true`) shows a filter input;
 * pass an object to customize its placeholder / "no results" message, or
 * `false` to hide it.
 */

type MultiSelectSearch = boolean | { placeholder?: string; emptyMessage?: string }

interface MultiSelectContextValue {
  values: string[]
  onValuesChange: (values: string[]) => void
  single: boolean
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  inputValue: string
  setInputValue: React.Dispatch<React.SetStateAction<string>>
  labels: Record<string, ReactNode>
}

const MultiSelectContext = React.createContext<MultiSelectContextValue | null>(null)

function useMultiSelect() {
  const context = React.useContext(MultiSelectContext)
  if (!context) {
    throw new Error("MultiSelect sub-components must be used inside <MultiSelect>")
  }
  return context
}

interface MultiSelectProps {
  values: string[]
  onValuesChange: (values: string[]) => void
  /** When true, selecting an option replaces the value and closes the dropdown. */
  single?: boolean
  children?: ReactNode
}

/**
 * Collects the value → label map straight from the React tree. The dropdown
 * content only mounts while it is open, so labels gathered via effects would
 * be unavailable until the first open — this way the trigger can display
 * pre-selected values' labels immediately (e.g. an edited form row).
 */
function collectLabels(children: ReactNode, labels: Record<string, ReactNode>) {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement<{ value?: string; children?: ReactNode }>(child)) return
    if (child.type === MultiSelectItem && typeof child.props.value === "string") {
      labels[child.props.value] = child.props.children
    }
    collectLabels(child.props.children, labels)
  })
}

function MultiSelect({
  children,
  values,
  onValuesChange,
  single = false,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")

  const labels = React.useMemo(() => {
    const map: Record<string, ReactNode> = {}
    collectLabels(children, map)
    return map
  }, [children])

  const contextValue = React.useMemo<MultiSelectContextValue>(
    () => ({
      values,
      onValuesChange,
      single,
      open,
      setOpen,
      inputValue,
      setInputValue,
      labels,
    }),
    [values, onValuesChange, single, open, inputValue, labels]
  )

  return (
    <MultiSelectContext.Provider value={contextValue}>
      <Popover open={open} onOpenChange={setOpen}>
        {children}
      </Popover>
    </MultiSelectContext.Provider>
  )
}

function MultiSelectTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof PopoverTrigger>) {
  return (
    <PopoverTrigger
      data-slot="multi-select-trigger"
      className={cn(
        "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
    </PopoverTrigger>
  )
}

function MultiSelectValue({ placeholder }: { placeholder?: string }) {
  const { values, single, labels, onValuesChange } = useMultiSelect()

  if (values.length === 0) {
    return <span className="truncate text-muted-foreground">{placeholder}</span>
  }

  if (single) {
    return <span className="truncate">{labels[values[0]] ?? values[0]}</span>
  }

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
      {values.map((value) => {
        const label = labels[value] ?? value
        const labelText = typeof label === "string" ? label : value
        return (
          <Badge key={value} variant="secondary" className="gap-1">
            <span className="truncate">{label}</span>
            <button
              type="button"
              aria-label={`Remove ${labelText}`}
              className="rounded-full opacity-60 outline-none transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50"
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => {
                event.stopPropagation()
                onValuesChange(values.filter((item) => item !== value))
              }}
            >
              <XIcon className="size-3!" />
            </button>
          </Badge>
        )
      })}
    </div>
  )
}

interface MultiSelectContentProps
  extends React.ComponentProps<typeof PopoverContent> {
  /** Show a search input. Pass an object to customize placeholder / empty message. */
  search?: MultiSelectSearch
}

function MultiSelectContent({
  className,
  children,
  search = true,
  ...props
}: MultiSelectContentProps) {
  const { inputValue, setInputValue } = useMultiSelect()
  const searchEnabled = typeof search === "object" ? true : search
  const inputRef = React.useRef<HTMLInputElement>(null)

  return (
    <PopoverContent
      align="start"
      sideOffset={6}
      initialFocus={searchEnabled ? inputRef : undefined}
      className={cn("w-[var(--anchor-width)] p-0", className)}
      {...props}
    >
      <Command shouldFilter={searchEnabled} loop className="w-full">
        {searchEnabled && (
          <CommandInput
            ref={inputRef}
            value={inputValue}
            onValueChange={setInputValue}
            placeholder={
              typeof search === "object" ? search.placeholder : "Search options…"
            }
          />
        )}
        <CommandList>
          {searchEnabled && (
            <CommandEmpty>
              {typeof search === "object" ? search.emptyMessage : "No results found."}
            </CommandEmpty>
          )}
          {children}
        </CommandList>
      </Command>
    </PopoverContent>
  )
}

function MultiSelectGroup({
  heading,
  className,
  children,
  ...props
}: React.ComponentProps<typeof CommandGroup>) {
  return (
    <CommandGroup heading={heading} className={className} {...props}>
      {children}
    </CommandGroup>
  )
}

function MultiSelectItem({
  value,
  className,
  children,
  ...props
}: React.ComponentProps<typeof CommandItem> & { value: string }) {
  const { values, onValuesChange, single, setOpen, setInputValue } = useMultiSelect()
  const isSelected = values.includes(value)

  return (
    <CommandItem
      value={value}
      data-checked={isSelected}
      onSelect={() => {
        if (single) {
          onValuesChange([value])
          setOpen(false)
        } else {
          onValuesChange(
            isSelected ? values.filter((item) => item !== value) : [...values, value]
          )
        }
        setInputValue("")
      }}
      className={className}
      {...props}
    >
      {children}
    </CommandItem>
  )
}

export {
  MultiSelect,
  MultiSelectContent,
  MultiSelectGroup,
  MultiSelectItem,
  MultiSelectTrigger,
  MultiSelectValue,
}
export type { MultiSelectSearch }
