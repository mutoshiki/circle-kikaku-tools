import { createContext, useContext, useRef, useState } from 'react';
import { AccordionItem, Button } from '@carbon/react';

const PaymentRowContext = createContext(null);

function PaymentRowToggle(props) {
  const row = useContext(PaymentRowContext);
  const { children, className, disabled, type, onClick, ['aria-expanded']: expanded, ['aria-controls']: controls, ['aria-label']: label } = props;
  return <div className="settlement-car-header">
    <h3 className="settlement-car-heading">
      <button ref={row.toggleRef} className={`${className} settlement-car-toggle`} disabled={disabled} type={type} onClick={onClick} aria-expanded={expanded} aria-controls={controls} aria-label={label} aria-describedby={row.describedBy}>
        {children}
      </button>
    </h3>
    <div className="settlement-car-actions">
      {row.driverMenu}
      <Button className="settlement-car-edit-action" kind="ghost" size="sm" aria-label={`${row.carLabel}の費用を${row.hasSavedCarExpenses ? '編集' : '入力'}`} onClick={event => row.onEdit(event, row.toggleRef)}>{row.hasSavedCarExpenses ? '費用を編集' : '費用を入力'}</Button>
    </div>
  </div>;
}

export default function SettlementPaymentRow({ rowId, carLabel, carName, rentalLabel = '', driverNames = [], splitAmount, clubAmount, compactAmount = false, hasSavedCarExpenses, details, driverMenu = null, onEdit }) {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef(null);
  const splitId = `settlement-car-${rowId}-split`;
  const clubId = `settlement-car-${rowId}-club`;
  const rowContext = {
    toggleRef,
    describedBy: compactAmount ? splitId : `${splitId} ${clubId}`,
    carLabel,
    driverMenu,
    hasSavedCarExpenses,
    onEdit,
  };
  const splitIsZero = !/[1-9]/.test(splitAmount);
  const clubIsZero = !/[1-9]/.test(clubAmount);
  const hasWideAmount = splitAmount.length >= 10 || clubAmount.length >= 10;
  const title = <div className={`settlement-car-summary${compactAmount ? ' settlement-car-summary--single-amount' : ''}${hasWideAmount ? ' settlement-car-summary--wide-amounts' : ''}`}>
    <span className="settlement-car-name">{carName}<span className="settlement-car-rental-label">{rentalLabel}</span>
      {driverNames.length > 1 && <span className="settlement-car-driver-names">運転手：{driverNames.join('、')}（車単位で一括支払い）</span>}
    </span>
    <div className="settlement-car-amounts" aria-label={`${carLabel}${compactAmount ? 'の合計支払額' : 'の支払い額'}`}>
      <span id={splitId} className="settlement-car-amount-category"><span className="settlement-car-amount-label">割勘から</span><span className={`settlement-car-amount-value${splitIsZero ? '' : ' settlement-car-amount-value--nonzero'}`}>{splitAmount}</span></span>
      {!compactAmount && <span id={clubId} className="settlement-car-amount-category"><span className="settlement-car-amount-label">部費から</span><span className={`settlement-car-amount-value${clubIsZero ? '' : ' settlement-car-amount-value--nonzero'}`}>{clubAmount}</span></span>}
    </div>
  </div>;

  return <PaymentRowContext.Provider value={rowContext}>
    <AccordionItem className="settlement-car" title={title} aria-label={`「${carLabel}」支払い内訳`} renderToggle={PaymentRowToggle} open={open} onHeadingClick={({ isOpen }) => setOpen(isOpen)}>
      <div className="settlement-car-details">
        {details}
      </div>
    </AccordionItem>
  </PaymentRowContext.Provider>;
}
