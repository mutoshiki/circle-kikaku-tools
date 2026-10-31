import { createElement, forwardRef } from 'react';

const SectionHeading = forwardRef(function SectionHeading({
  as = 'h2',
  id,
  title,
  description,
  actions,
  className = '',
  titleTabIndex,
}, ref) {
  const rootClassName = ['ui-section-heading', className].filter(Boolean).join(' ');
  return <div className={rootClassName}>
    <div className="ui-section-heading__copy">
      {createElement(as, { id, ref, tabIndex: titleTabIndex, className: 'ui-section-heading__title' }, title)}
      {description && <p className="ui-section-heading__description">{description}</p>}
    </div>
    {actions && <div className="ui-section-heading__actions">{actions}</div>}
  </div>;
});

export default SectionHeading;
