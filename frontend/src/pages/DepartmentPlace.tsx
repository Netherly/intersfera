import { useParams } from 'react-router-dom';
import { departmentLabel, isDepartmentId } from '@/lib/departments';

export function DepartmentPlace() {
  const { id } = useParams();
  const title = id && isDepartmentId(id) ? departmentLabel(id) : 'Отдел';

  return (
    <div>
      <h1 className="page-title">{title}</h1>
      <div className="card">
        <p>Раздел готовится. Здесь появятся документы и задачи отдела.</p>
        <p className="text-muted">Сотрудники отдела уже видят свою вкладку и свою статистику.</p>
      </div>
    </div>
  );
}
