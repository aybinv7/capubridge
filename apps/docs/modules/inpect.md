# DOM Inspector

Chrome DevTools-style DOM tree inspector with element selection, style editing, and computed property views.

## Dom Tree

Virtual-scrolled tree view of the DOM:![Screenshot showing the virtual-scrolled DOM tree with expandable nodes]

- **Virtual scrolling** — handles trees with 10,000+ nodes smoothly
- **Expand/collapse** — click the arrow or double-click the node
- **Search** — find elements by tag, class, or id
- **Filter by display** — hide/show text, comment, and element nodes

### Node types

| Icon    | Node type              | Description                            |
| ------- | ---------------------- | -------------------------------------- |
| `▸`     | Element                | HTML element (`<div>`, `<span>`, etc.) |
| `#text` | Text                   | Text content                           |
| `<!-->` | Comment                | HTML comment                           |
| `?`     | Processing instruction | XML/DOCTYPE                            |

### Element picker

1. Click the **picker icon** in the toolbar
2. Hover over elements in the live preview
3. Click to select
4. The inspector scrolls to and highlights the node

## Element Detail

When an element is selected, the detail panel shows:![Screenshot showing the element detail panel with attributes and properties tabs]

### Attributes tab

View and edit HTML attributes:

- **id** — element ID
- **class** — class list
- **data-\*** — data attributes
- Other attributes
  Click an attribute to edit it inline.

### Properties tab

View the JavaScript properties of the element (the DOM node as a JS object).

## Styles tab

View and edit CSS styles applied to the element:![Screenshot showing the styles panel with selector, property, and value columns]

### Style sources

| Source             | Priority | Editable |
| ------------------ | -------- | -------- |
| User agent         | Lowest   | No       |
| Inline styles      |          | Yes      |
| CSS files          |          | Yes      |
| `<style>` tags     |          | No       |
| **Element styles** | Highest  | Yes      |

### Add/edit styles

1. Click the **+** button in the styles panel
2. Or click an existing property value
3. Type the property name or value
4. Press `Enter` to apply
   Changes are written through CDP — the target receives them immediately.

### Pseudo-states

Toggle pseudo-classes to see their styles:![Screenshot showing pseudo-class toggles for :hover, :active, :focus, :focus-within, and :focus-visible]

- `:hover` — mouse over
- `:active` — active/pressed
- `:focus` — focused
- `:focus-within` — any child is focused
- `:focus-visible` — keyboard focus indicator

## Computed tab

See the final computed CSS values:![Screenshot showing the computed panel with property and value columns]
Each property shows the final value after all cascading styles are resolved, plus the source selector.

## Box Model tab

Visual box model diagram:![Screenshot showing the box model diagram with content, padding, border, and margin labeled]
Shows:

- **Content** — width and height
- **Padding** — top, right, bottom, left
- **Border** — top, right, bottom, left
- **Margin** — top, right, bottom, left
  Click any value to edit it.

## Inspect plugins

Capubridge supports **inspect plugins** — integrations with Vue DevTools and React DevTools:![Screenshot showing the inspect plugin route selector]

### Vue DevTools

When a Vue app is detected, the **Vue DevTools** tab activates:![Screenshot showing the Vue DevTools panel with component tree and inspector]
Shows:

- **Component tree** — hierarchical view of Vue components
- **Props** — component props
- **State** — reactive state
- **Events** — emitted events

### React DevTools

When a React app is detected, the **React DevTools** tab activates. Shows the React component tree with props and state inspection.
