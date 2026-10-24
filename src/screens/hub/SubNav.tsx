// Sub-pages within a hub tab: a row of index-card tabs under the header. Columns
// on a page with a SubNav use the `belowNav` class to start under it.
import styles from './Hub.module.css';

export function SubNav<T extends string>({ items, value, onChange }: { items: { id: T; label: string }[]; value: T; onChange: (id: T) => void }) {
  return (
    <nav className={styles.subNav}>
      {items.map((i) => (
        <button key={i.id} className={value === i.id ? styles.subNavOn : ''} onClick={() => onChange(i.id)}>
          {i.label}
        </button>
      ))}
    </nav>
  );
}
