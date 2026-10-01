import { Column, Grid } from '@carbon/react';

export default function ProjectPage({ context, title, description, metadata = [], actions, status, back, children }) {
  return <div className="project-page">
    <Grid fullWidth className="project-page__grid">
      <Column sm={4} md={8} lg={16} xlg={16} max={16}>
        <header className="project-page__header">
          <div className="project-page__heading">
            {back && <div className="project-page__back">{back}</div>}
            {context && <p className="project-page__context">{context}</p>}
            <h1 id="project-page-title" tabIndex={-1}>{title}</h1>
            {description && <p>{description}</p>}
          </div>
          {!!metadata.length && <dl className="project-page__metadata">
            {metadata.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
          </dl>}
          {actions && <div className="project-page__actions" aria-label="ページ操作">{actions}</div>}
        </header>
      </Column>
      <Column sm={4} md={8} lg={16} xlg={16} max={16}>
        <div className="project-page__body">
          {status && <div className="project-page__status" aria-label="ページの状態">{status}</div>}
          {children}
        </div>
      </Column>
    </Grid>
  </div>;
}
