export const meta = {
  title: 'Placeholder',
  description: '셸 동작 확인용 임시 데모. TASK-04에서 교체된다.',
};

export async function run(target: HTMLElement): Promise<void> {
  const p = document.createElement('p');
  p.textContent = 'Demo shell is alive.';
  target.append(p);
}
