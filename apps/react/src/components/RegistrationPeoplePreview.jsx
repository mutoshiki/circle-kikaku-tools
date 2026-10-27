import { Accordion, AccordionItem, Tag } from '@carbon/react';
import { summarizePeople } from './registration-input.js';

export default function RegistrationPeoplePreview({
  people, participants, canonical, warnings = [], spreadsheet = false, expanded = false, onToggleDetails,
}) {
  const summary = summarizePeople(people);
  const existing = people.filter(person => canonical.findParticipantIdByName(participants, person.name)).length;
  return <section className="registration-modal__preview" aria-label={spreadsheet ? '回答の読み取り結果' : '参加者の登録内容'}>
    <p className="registration-modal__summary">
      読み取り結果 {summary.total}人（車出しあり {summary.drivers}人／学年未設定 {summary.unknownGrades}人）
    </p>
    {existing > 0 && <p className="registration-modal__existing">
      同じ名前で登録済みの{existing}人は、新たに追加せず、学年・車出しの指定を反映します。
    </p>}
    {warnings.length > 0 && <div className="registration-modal__warnings">
      <p>読み取れなかった項目があります</p>
      <ul>{warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul>
    </div>}
    {spreadsheet && <Accordion>
      <AccordionItem title="読み取り結果を確認" open={expanded} onHeadingClick={onToggleDetails}>
        <ul className="registration-modal__people-list">
          {people.map(person => {
            const isExisting = !!canonical.findParticipantIdByName(participants, person.name);
            return <li key={person.normalizedName || person.name}>
              <span>{person.name}</span>
              <span>{Number(person.grade) > 0 ? `${person.grade}年` : '学年未設定'}</span>
              <span>{person.driver ? '車出し' : '車出しなし'}</span>
              {isExisting && <Tag type="cool-gray" size="sm">登録済み</Tag>}
            </li>;
          })}
        </ul>
      </AccordionItem>
    </Accordion>}
  </section>;
}
