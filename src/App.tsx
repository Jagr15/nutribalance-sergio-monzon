import AppRouter from "./app/router/AppRouter"; // Importa tu configurador de rutas

function App() {
  return (
    // Ya no ponemos AdminLayout ni DashboardPage aquí.
    // AppRouter se encargará de decidir qué mostrar según la URL.
    <AppRouter />
  );
}

export default App;