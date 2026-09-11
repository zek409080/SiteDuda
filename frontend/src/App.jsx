import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Agenda from './pages/Agenda.jsx';
import Patients from './pages/Patients.jsx';
import PatientDetail from './pages/PatientDetail.jsx';
import Notes from './pages/Notes.jsx';
import Settings from './pages/Settings.jsx';

export default function App() {
  const { status } = useAuth();

  if (status === 'checking') {
    return <div className="boot">Carregando...</div>;
  }

  if (status === 'out') {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Agenda />} />
        {/* Mesma tela da agenda, ja com o formulario de novo atendimento
            aberto. Vira um endereco proprio para caber no menu. */}
        <Route path="/novo-agendamento" element={<Agenda />} />
        <Route path="/pacientes" element={<Patients />} />
        <Route path="/pacientes/:id" element={<PatientDetail />} />
        <Route path="/notas" element={<Notes />} />
        <Route path="/configuracoes" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
