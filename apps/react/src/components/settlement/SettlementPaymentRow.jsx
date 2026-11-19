import { createContext, useContext, useRef, useState } from 'react';
import { AccordionItem, Button } from '@carbon/react';
import { getPaymentSourcePresentation } from './presentation.js';

const money = value => {
  const rounded = Math.round(Number(value) || 0);
  return `${rounded < 0 ? '−' : ''}¥${Math.abs(rounded).toLocaleString('ja-JP')}`;
};

const PaymentRowContext = createContext(null);

function PaymentRowToggle(props) {
  const row = useContext(PaymentRowContext);
  const { children, className, disabled, type, onClick, ['aria-expanded']: expanded, ['aria-controls']: controls, ['aria-label']: label } = props;
  return <div className={`settlement-car-header${row.compactAmount ? ' settlement-car-summary--single-amount' : ''}${row.hasWideAmount ? ' settlement-car-summary--wide-amounts' : ''}`}>
    <div className="settlement-car-topline">
      <h3 className="settlement-car-heading">{row.name}</h3>
      <div id={row.totalId} className="settlement-car-total"><span>支払額</span><strong>{row.showUnentered ? '費用未入力' : money(row.totalAmount)}</strong></div>
    </div>
    {row.sourceRows.length > 0 && <div className="settlement-car-amounts" aria-label={`${row.carLabel}の支払い額`}>
      {row.sourceRows.map(({ id, label, value }) => <span id={id === 'club' ? row.clubId : row.splitId} className="settlement-car-amount-category" key={id}><span className="settlement-car-amount-label">{label}</span>{value && <span className="settlement-car-amount-value">{value}</span>}</span>)}
    </div>}
    {row.expenseMessage && <p className="settlement-car-expense-status" role="status">{row.expenseMessage}</p>}
    <button ref={row.toggleRef} className={`${className} settlement-car-toggle`} disabled={disabled} type={type} onClick={onClick} aria-expanded={expanded} aria-controls={controls} aria-label={`${label}：${row.toggleLabel}`} aria-describedby={row.describedBy}>
      {children}
    </button>
    <div className="settlement-car-actions">
      {row.driverMenu}
      <Button className="settlement-car-edit-action" kind={row.showUnentered ? 'primary' : 'ghost'} size="sm" aria-label={`${row.carLabel}の費用を${row.hasSavedCarExpenses ? '編集' : '入力'}`} onClick={event => row.onEdit(event, row.toggleRef)}>{row.hasSavedCarExpenses ? '費用を編集' : '費用を入力'}</Button>
    </div>
  </div>;
}

export default function SettlementPaymentRow({ rowId, carLabel, carName, rentalLabel = '', driverNames = [], adjustedTotalPay, adjustedSplitPay, adjustedClubPay, showUnentered = false, expenseMessage = '', hasSavedCarExpenses, details, driverMenu = null, onEdit }) {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef(null);
  const totalId = `settlement-car-${rowId}-total`;
  const splitId = `settlement-car-${rowId}-split`;
  const clubId = `settlement-car-${rowId}-club`;
  const splitAmount = Number(adjustedSplitPay) || 0;
  const clubAmount = Number(adjustedClubPay) || 0;
  const totalAmount = Number(adjustedTotalPay) || 0;
  const sourceRows = getPaymentSourcePresentation(totalAmount, splitAmount, clubAmount);
  const compactAmount = sourceRows.length === 1;
  const hasWideAmount = sourceRows.some(({ value }) => value?.length >= 10);
  const name = <span className="settlement-car-name">{carName}<span className="settlement-car-rental-label">{rentalLabel}</span>
      {driverNames.length > 1 && <span className="settlement-car-driver-names">運転手：{driverNames.join('、')}（車単位で一括支払い）</span>}
    </span>;
  const toggleLabel = open ? '内訳を閉じる' : '支払いの内訳';
  const rowContext = { toggleRef, toggleLabel, totalId, describedBy: [totalId, ...sourceRows.map(({ id }) => id === 'club' ? clubId : splitId)].join(' '), carLabel, clubId, splitId, driverMenu, hasSavedCarExpenses, showUnentered, expenseMessage, onEdit, name, sourceRows, compactAmount, hasWideAmount, totalAmount };

  return <PaymentRowContext.Provider value={rowContext}>
    <AccordionItem className="settlement-car" title={toggleLabel} aria-label={`「${carLabel}」支払い内訳`} renderToggle={PaymentRowToggle} open={open} onHeadingClick={({ isOpen }) => setOpen(isOpen)}>
      <div className="settlement-car-details">
        {details}
      </div>
    </AccordionItem>
  </PaymentRowContext.Provider>;
}
