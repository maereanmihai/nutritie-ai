import AlimenteTab from './AlimenteTab';

function FoodPickerModal({ th, darkMode, customFoods, setCustomFoods, onAddMeal, onClose, onSendToCoach }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: th.bg2, borderRadius: '24px 24px 0 0', maxHeight: '90vh', display: 'flex', flexDirection: 'column', border: `1px solid ${th.border}`, borderBottom: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px 12px' }}>
          <div style={{ fontSize: '17px', fontWeight: 800, color: th.text }}>🍽 Adaugă masă</div>
          <button onClick={onClose} style={{ background: th.card2, border: 'none', borderRadius: '10px', color: th.text2, padding: '6px 12px', cursor: 'pointer', fontSize: '16px' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <AlimenteTab th={th} customFoods={customFoods} setCustomFoods={setCustomFoods} onAddMeal={(meal) => { onAddMeal(meal); onClose(); }}/>
        </div>
      </div>
    </div>
  );
}

export default FoodPickerModal;
