import React, { useEffect, useState } from 'react';
import { bitable, type IRecord } from '@lark-base-open/js-sdk';
import { Spin, Alert } from 'antd';
import { interpolateColor } from '../utils/colorUtils';

interface PersonData {
  id: string;
  name: string;
  perf: number;
  department: string;
  generalDom: number;
}

interface DepartmentBand {
  name: string;
  startX: number;
  width: number;
  people: PersonData[];
}

const PerformanceChart: React.FC = () => {
  const [data, setData] = useState<PersonData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        console.log('🔍 Fetching table "person-perf"...');
        const table = await bitable.base.getTableByName('person-perf');

        if (!table) {
          throw new Error('Table "person-perf" not found');
        }
        console.log('✅ Table found:', table);

        const records = await table.getRecords({ pageSize: 5000 });
        console.log('📊 Records fetched:', records.records.length, 'records');
        
        const fieldMetaList = await table.getFieldMetaList();
        console.log('📋 Available fields:', fieldMetaList.map(f => f.name));

        // Find field IDs by name
        const perfField = fieldMetaList.find(f => f.name === 'perf');
        const deptField = fieldMetaList.find(f => f.name === 'Department');
        const personField = fieldMetaList.find(f => f.name === 'Person');
        const generalDomField = fieldMetaList.find(f => f.name === 'general-dom');

        console.log('🔎 Field mapping:', {
          perf: perfField?.name,
          department: deptField?.name,
          person: personField?.name,
          generalDom: generalDomField?.name,
        });

        if (!perfField || !deptField || !personField || !generalDomField) {
          throw new Error('Required fields not found');
        }

        // Parse records into PersonData
        const parsedData: PersonData[] = records.records
          .map((record: IRecord) => {
            const perfValue = record.fields[perfField.id];
            const deptValue = record.fields[deptField.id];
            const personValue = record.fields[personField.id];
            const generalDomValue = record.fields[generalDomField.id];

            console.log('📝 Record values:', {
              recordId: record.recordId,
              perfValue,
              deptValue,
              personValue,
              generalDomValue,
            });

            // Extract department name (handle array or single value)
            let deptName = 'Unknown';
            if (Array.isArray(deptValue) && deptValue.length > 0) {
              deptName = deptValue[0].text || deptValue[0].name || 'Unknown';
            } else if (deptValue && typeof deptValue === 'object') {
              deptName = (deptValue as any).text || (deptValue as any).name || 'Unknown';
            }

            // Extract person name
            let personName = 'Unknown';
            if (Array.isArray(personValue) && personValue.length > 0) {
              personName = personValue[0].name || personValue[0].text || 'Unknown';
            } else if (personValue && typeof personValue === 'object') {
              personName = (personValue as any).name || (personValue as any).text || 'Unknown';
            }

            // Parse perf value (handle both string and number)
            let perf = 0;
            if (typeof perfValue === 'number') {
              perf = perfValue;
            } else if (typeof perfValue === 'string') {
              perf = parseFloat(perfValue) || 0;
            }

            // Parse general-dom value (handle both string and number)
            let generalDom = 0;
            if (typeof generalDomValue === 'number') {
              generalDom = generalDomValue;
            } else if (typeof generalDomValue === 'string') {
              generalDom = parseFloat(generalDomValue) || 0;
            }

            return {
              id: record.recordId,
              name: personName,
              perf,
              department: deptName,
              generalDom,
            };
          })
          .filter(p => p.perf > 0); // Filter out invalid data

        console.log('✨ Parsed data:', parsedData.length, 'valid records');
        console.log('📊 Sample data:', parsedData.slice(0, 3));
        setData(parsedData);
      } catch (err) {
        console.error('❌ Failed to fetch data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Calculate department bands and layout
  const calculateLayout = (): DepartmentBand[] => {
    if (data.length === 0) return [];

    // Group by department
    const deptMap = new Map<string, PersonData[]>();
    data.forEach(person => {
      const dept = person.department;
      if (!deptMap.has(dept)) {
        deptMap.set(dept, []);
      }
      deptMap.get(dept)!.push(person);
    });

    // Create bands with fixed width
    const bandWidth = 150;
    const bands: DepartmentBand[] = [];
    let currentX = 0;

    Array.from(deptMap.entries()).forEach(([deptName, people]) => {
      bands.push({
        name: deptName,
        startX: currentX,
        width: bandWidth,
        people,
      });
      currentX += bandWidth;
    });

    return bands;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return <Alert message={error} type="error" showIcon />;
  }

  if (data.length === 0) {
    return <Alert message="No data available" type="info" showIcon />;
  }

  const bands = calculateLayout();
  const chartWidth = bands.reduce((sum, b) => sum + b.width, 0) + 100;
  const chartHeight = 600;
  const padding = { top: 40, right: 50, bottom: 60, left: 60 };

  // Calculate Y-axis scale
  const maxPerf = Math.max(...data.map(p => p.perf));
  const minPerf = Math.min(...data.map(p => p.perf));
  const perfRange = maxPerf - minPerf;
  const yScale = (perf: number) => {
    return chartHeight - padding.bottom - ((perf - minPerf) / perfRange) * (chartHeight - padding.top - padding.bottom);
  };

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto' }}>
      <svg width={chartWidth} height={chartHeight} style={{ border: '1px solid #e0e0e0' }}>
        {/* Y-axis */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={chartHeight - padding.bottom}
          stroke="#333"
          strokeWidth={2}
        />

        {/* Y-axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
          const value = minPerf + perfRange * ratio;
          const y = yScale(value);
          return (
            <g key={ratio}>
              <line
                x1={padding.left - 5}
                y1={y}
                x2={padding.left}
                y2={y}
                stroke="#333"
                strokeWidth={1}
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                fontSize={12}
                fill="#666"
              >
                {value.toFixed(2)}
              </text>
            </g>
          );
        })}

        {/* Y-axis label */}
        <text
          x={20}
          y={chartHeight / 2}
          textAnchor="middle"
          fontSize={14}
          fill="#333"
          transform={`rotate(-90, 20, ${chartHeight / 2})`}
        >
          Performance
        </text>

        {/* X-axis */}
        <line
          x1={padding.left}
          y1={chartHeight - padding.bottom}
          x2={chartWidth - padding.right}
          y2={chartHeight - padding.bottom}
          stroke="#333"
          strokeWidth={2}
        />

        {/* Department bands and labels */}
        {bands.map((band, idx) => {
          const x = padding.left + band.startX;
          const bandCenterX = x + band.width / 2;

          return (
            <g key={idx}>
              {/* Band separator */}
              {idx > 0 && (
                <line
                  x1={x}
                  y1={padding.top}
                  x2={x}
                  y2={chartHeight - padding.bottom}
                  stroke="#e0e0e0"
                  strokeWidth={1}
                  strokeDasharray="4,4"
                />
              )}

              {/* Department label */}
              <text
                x={bandCenterX}
                y={chartHeight - padding.bottom + 20}
                textAnchor="middle"
                fontSize={12}
                fill="#333"
                fontWeight="bold"
              >
                {band.name}
              </text>
            </g>
          );
        })}

        {/* Data points (dots and labels) */}
        {bands.map((band) => {
          const bandX = padding.left + band.startX;

          return band.people.map((person) => {
            // Random x position within the band
            const randomOffset = Math.random() * (band.width - 20) + 10;
            const x = bandX + randomOffset;
            const y = yScale(person.perf);
            const color = interpolateColor(person.generalDom);

            return (
              <g key={person.id}>
                {/* Dot */}
                <circle
                  cx={x}
                  cy={y}
                  r={5}
                  fill={color}
                  stroke="#333"
                  strokeWidth={1}
                />

                {/* Person name */}
                <text
                  x={x}
                  y={y - 10}
                  textAnchor="middle"
                  fontSize={10}
                  fill={color}
                  fontWeight="500"
                >
                  {person.name}
                </text>
              </g>
            );
          });
        })}
      </svg>
    </div>
  );
};

export default PerformanceChart;
