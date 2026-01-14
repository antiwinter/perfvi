import React from 'react';
import { ConfigProvider } from 'antd';
import PerformanceChart from './components/PerformanceChart';

const App: React.FC = () => {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#3370ff',
          borderRadius: 4,
        },
      }}
    >
      <div style={{ height: '100%', background: '#fff', padding: '16px' }}>
        <PerformanceChart />
      </div>
    </ConfigProvider>
  );
};

export default App;
