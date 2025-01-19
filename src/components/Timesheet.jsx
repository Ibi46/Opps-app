import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

const MonthlyTimesheet = () => {
  const { employeeId } = useParams();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [timeEntries, setTimeEntries] = useState({});
  const [staffCode, setStaffCode] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [grade, setGrade] = useState('');
  const [loading, setLoading] = useState(true);
  const [clientEntries, setClientEntries] = useState([
    { clientName: '', clientNo: '', natureOfWork: '', hours: 0, percentage: 0 },
    { clientName: '', clientNo: '', natureOfWork: '', hours: 0, percentage: 0 },
    { clientName: '', clientNo: '', natureOfWork: '', hours: 0, percentage: 0 },
    { clientName: '', clientNo: '', natureOfWork: '', hours: 0, percentage: 0 },
    { clientName: '', clientNo: '', natureOfWork: '', hours: 0, percentage: 0 },
    { clientName: '', clientNo: '', natureOfWork: '', hours: 0, percentage: 0 },
    { clientName: '', clientNo: '', natureOfWork: '', hours: 0, percentage: 0 },
    { clientName: '', clientNo: '', natureOfWork: '', hours: 0, percentage: 0 }
  ]);

  const nonChargeableTypes = [
    { id: 'office', label: 'Office Work' },
    { id: 'training', label: 'Training' },
    { id: 'leave', label: 'Leave' },
    { id: 'overtime', label: 'Overtime Hours' },
    { id: 'holiday', label: 'Public Holiday' }
  ];

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const weekDays = ['Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue'];

  // Fetch employee data
  useEffect(() => {
    const fetchEmployeeData = async () => {
      if (!employeeId) return;
      
      try {
        const response = await fetch(`http://localhost:5000/api/employees/${employeeId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch employee data');
        }
        
        const data = await response.json();
        setEmployeeName(data.name || '');
        setStaffCode(data.staffCode || '');
        setGrade(data.grade || '');
      } catch (error) {
        console.error('Error fetching employee data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployeeData();
  }, [employeeId]);

  // Fetch timesheet data
  useEffect(() => {
    const fetchTimesheet = async () => {
      if (!employeeId) return;

      try {
        const response = await fetch(`http://localhost:5000/api/timesheet/${employeeId}/${selectedYear}/${selectedMonth + 1}`);
        if (!response.ok) {
          throw new Error('Failed to fetch timesheet data');
        }

        const data = await response.json();
        const newEntries = {};
        
        // Process timesheet entries
        data.forEach(entry => {
          const day = new Date(entry.date).getDate();
          if (entry.type === 'chargeable') {
            newEntries[`${entry.client_index}_${day}`] = entry.hours.toString();
            
            // Update client entries if available
            if (entry.client_details && entry.client_index < clientEntries.length) {
              const newClientEntries = [...clientEntries];
              newClientEntries[entry.client_index] = {
                ...newClientEntries[entry.client_index],
                clientName: entry.client_details.name || '',
                clientNo: entry.client_details.code || '',
                natureOfWork: entry.client_details.workNature || ''
              };
              setClientEntries(newClientEntries);
            }
          } else {
            newEntries[`${entry.type}_${day}`] = entry.hours.toString();
          }
        });

        setTimeEntries(newEntries);
      } catch (error) {
        console.error('Error fetching timesheet:', error);
      }
    };

    fetchTimesheet();
  }, [employeeId, selectedMonth, selectedYear]);

  const getDaysInMonth = (month, year) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const handleTimeEntry = (rowIndex, day, value) => {
    if (value === '' || (parseInt(value) >= 0 && parseInt(value) <= 8)) {
      setTimeEntries(prev => ({
        ...prev,
        [`${rowIndex}_${day}`]: value
      }));
    }
  };

  // Initialize timesheet with empty values
  React.useEffect(() => {
    const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
    const newEntries = { ...timeEntries };
    
    // For each day in the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(selectedYear, selectedMonth, day);
      const dayOfWeek = date.getDay();
      
      // Set empty values for all client entries
      clientEntries.forEach((_, index) => {
        newEntries[`${index}_${day}`] = '';
      });
      // Set empty values for all non-chargeable types
      nonChargeableTypes.forEach(type => {
        newEntries[`${type.id}_${day}`] = '';
      });
    }
    
    setTimeEntries(newEntries);
  }, [selectedMonth, selectedYear]);

  const calculateTotalHours = (rowIndex) => {
    let total = 0;
    const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
    for (let day = 1; day <= daysInMonth; day++) {
      const value = timeEntries[`${rowIndex}_${day}`];
      if (value) {
        total += parseInt(value) || 0;
      }
    }
    return total;
  };

  const handleSubmit = async () => {
    if (!employeeId) return;

    try {
      const entries = [];
      const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);

      // Collect chargeable entries
      clientEntries.forEach((entry, index) => {
        for (let day = 1; day <= daysInMonth; day++) {
          const hours = timeEntries[`${index}_${day}`];
          if (hours) {
            entries.push({
              employee_id: parseInt(employeeId),
              date: `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
              hours: parseInt(hours),
              type: 'chargeable',
              client_index: index,
              client_details: {
                name: entry.clientName,
                code: entry.clientNo,
                workNature: entry.natureOfWork
              }
            });
          }
        }
      });

      // Collect non-chargeable entries
      nonChargeableTypes.forEach(type => {
        for (let day = 1; day <= daysInMonth; day++) {
          const hours = timeEntries[`${type.id}_${day}`];
          if (hours) {
            entries.push({
              employee_id: parseInt(employeeId),
              date: `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
              hours: parseInt(hours),
              type: type.id
            });
          }
        }
      });

      // Save all entries
      await Promise.all(entries.map(entry =>
        fetch('http://localhost:5000/api/timesheet/entry', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(entry)
        })
      ));

      alert('Timesheet submitted successfully!');
    } catch (error) {
      console.error('Error submitting timesheet:', error);
      alert('Failed to submit timesheet. Please try again.');
    }
  };

  return (
    <div className="w-full bg-white p-6 print:p-0 shadow-xl rounded-xl">
      {/* Header */}
      <div className="flex justify-between items-start mb-6 print:mb-2">
        <div className="flex-1">
          <div className="grid grid-cols-2 gap-6">
            <div className="relative">
              <label className="text-sm font-medium text-gray-600 mb-1 block">NAME</label>
              <div className="text-base text-gray-900 py-1">{employeeName}</div>
            </div>
            <div className="relative">
              <label className="text-sm font-medium text-gray-600 mb-1 block">GRADE</label>
              <div className="text-base text-gray-900 py-1">{grade}</div>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm font-medium text-gray-600">STAFF CODE:</span>
            <div className="text-base text-gray-900 py-1">{staffCode}</div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-600">MONTH:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="border-b-2 border-gray-200 focus:border-blue-500 outline-none py-1 px-2 transition-all duration-200 bg-transparent appearance-none cursor-pointer hover:border-gray-300"
            >
              {months.map((month, index) => (
                <option key={index} value={index}>{month}</option>
              ))}
            </select>
            <span className="text-sm font-medium text-gray-600 ml-3">YEAR:</span>
            <input
              type="text"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="border-b-2 border-gray-200 focus:border-blue-500 outline-none w-20 text-right py-1 px-0 transition-all duration-200 bg-transparent"
            />
          </div>
        </div>
      </div>

      {/* Timesheet Grid */}
      <div className="overflow-x-auto rounded-xl shadow-lg max-w-full">
        <table className="w-full text-sm border-separate border-spacing-0 bg-white">
          <thead>
            <tr>
              <th className="sticky top-0 border border-gray-200 bg-gray-50/80 backdrop-blur-sm px-2 py-1.5 font-semibold text-gray-700 w-[85px]">DATES</th>
              {Array.from({ length: getDaysInMonth(selectedMonth, selectedYear) }, (_, day) => {
                const date = new Date(selectedYear, selectedMonth, day + 1);
                const isWeekend = date.getDay() === 5 || date.getDay() === 6;
                return (
                  <th key={day} className={`sticky top-0 border border-gray-200 backdrop-blur-sm px-0.5 py-1.5 text-center font-semibold text-gray-700 ${isWeekend ? 'w-[35px] bg-gray-100/90' : 'w-[30px] bg-gray-50/80'}`}>{day + 1}</th>
                );
              })}
              <th className="sticky top-0 border border-gray-200 bg-gray-50/80 backdrop-blur-sm px-2 py-1.5 font-semibold text-gray-700 w-[65px]">HOURS</th>
              <th className="sticky top-0 border border-gray-200 bg-gray-50/80 backdrop-blur-sm px-2 py-1.5 font-semibold text-gray-700 w-[65px]">TOTAL</th>
              <th className="sticky top-0 border border-gray-200 bg-gray-50/80 backdrop-blur-sm px-2 py-1.5 font-semibold text-gray-700 w-[150px]">CLIENT NAME</th>
              <th className="sticky top-0 border border-gray-200 bg-gray-50/80 backdrop-blur-sm px-2 py-1.5 font-semibold text-gray-700 w-[85px]">CLIENT NO.</th>
              <th className="sticky top-0 border border-gray-200 bg-gray-50/80 backdrop-blur-sm px-2 py-1.5 font-semibold text-gray-700 w-[150px]">NATURE OF WORK</th>
              <th className="sticky top-0 border border-gray-200 bg-gray-50/80 backdrop-blur-sm px-2 py-1.5 font-semibold text-gray-700 w-[45px]">%</th>
            </tr>
            <tr>
              <th className="border border-gray-200 px-1 py-0.5 bg-gray-50/60"></th>
              {Array.from({ length: getDaysInMonth(selectedMonth, selectedYear) }, (_, day) => {
                const date = new Date(selectedYear, selectedMonth, day + 1);
                const isWeekend = date.getDay() === 5 || date.getDay() === 6;
                return (
                  <th key={day} className={`border border-gray-200 px-0 py-0.5 text-[10px] font-medium ${isWeekend ? 'bg-gray-100/70 text-gray-600' : 'bg-gray-50/60 text-gray-500'}`}>
                    {weekDays[date.getDay()]}
                  </th>
                );
              })}
              <th colSpan="6" className="border border-gray-200 bg-gray-50/60"></th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {/* Chargeable Hours Rows */}
            {clientEntries.map((entry, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-blue-50/30 transition-colors duration-150">
                <td className="border border-gray-200 px-1 py-0.5"></td>
                {Array.from({ length: getDaysInMonth(selectedMonth, selectedYear) }, (_, day) => {
                  const date = new Date(selectedYear, selectedMonth, day + 1);
                  return (
                    <td key={day} className="border border-gray-200 p-0">
                      <input
                        type="text"
                        value={timeEntries[`${rowIndex}_${day + 1}`] || ''}
                        onChange={(e) => handleTimeEntry(rowIndex, day + 1, e.target.value)}
                        className="w-full h-6 text-center focus:outline-none transition-all duration-200 text-sm focus:bg-blue-50/50"
                        maxLength="1"
                      />
                    </td>
                  );
                })}
                <td className="border border-gray-200 px-1 py-0.5 text-center text-sm font-medium">{calculateTotalHours(rowIndex)}</td>
                <td className="border border-gray-200 px-1 py-0.5 text-center text-sm font-medium">{calculateTotalHours(rowIndex)}</td>
                <td className="border border-gray-200 p-0">
                  <input
                    type="text"
                    value={entry.clientName}
                    onChange={(e) => {
                      const newEntries = [...clientEntries];
                      newEntries[rowIndex].clientName = e.target.value;
                      setClientEntries(newEntries);
                    }}
                    className="w-full h-6 px-1 focus:outline-none focus:bg-blue-50/50 transition-all duration-200 text-sm"
                  />
                </td>
                <td className="border border-gray-200 p-0">
                  <input
                    type="text"
                    value={entry.clientNo}
                    onChange={(e) => {
                      const newEntries = [...clientEntries];
                      newEntries[rowIndex].clientNo = e.target.value;
                      setClientEntries(newEntries);
                    }}
                    className="w-full h-6 px-1 focus:outline-none focus:bg-blue-50/50 transition-all duration-200 text-sm"
                  />
                </td>
                <td className="border border-gray-200 p-0">
                  <input
                    type="text"
                    value={entry.natureOfWork}
                    onChange={(e) => {
                      const newEntries = [...clientEntries];
                      newEntries[rowIndex].natureOfWork = e.target.value;
                      setClientEntries(newEntries);
                    }}
                    className="w-full h-6 px-1 focus:outline-none focus:bg-blue-50/50 transition-all duration-200 text-sm"
                  />
                </td>
                <td className="border border-gray-200 px-1 py-0.5 text-center text-sm font-medium">{entry.percentage}</td>
              </tr>
            ))}

            {/* Total Chargeable Hours Row */}
            <tr className="bg-gray-50/60 font-medium">
              <td className="border border-gray-200 px-2 py-1 font-medium">Total Chargeable Hours</td>
              {Array.from({ length: getDaysInMonth(selectedMonth, selectedYear) }, (_, day) => (
                <td key={day} className="border border-gray-200 px-2 py-1 text-center">
                  {clientEntries.reduce((sum, _, index) => {
                    const value = timeEntries[`${index}_${day + 1}`];
                    return sum + (parseInt(value) || 0);
                  }, 0)}
                </td>
              ))}
              <td className="border border-gray-200 px-2 py-1 text-center font-medium">
                {clientEntries.reduce((sum, _, index) => sum + calculateTotalHours(index), 0)}
              </td>
              <td className="border border-gray-200 px-2 py-1 text-center font-medium">
                {clientEntries.reduce((sum, _, index) => sum + calculateTotalHours(index), 0)}
              </td>
              <td colSpan="4" className="border border-gray-200"></td>
            </tr>

            {/* Non-Chargeable Section */}
            <tr>
              <td colSpan={getDaysInMonth(selectedMonth, selectedYear) + 7} className="border border-gray-200 bg-gray-100/80 px-3 py-2 font-semibold text-gray-700">
                Non-Chargeable Hours
              </td>
            </tr>
            {nonChargeableTypes.map(type => (
              <tr key={type.id} className="hover:bg-blue-50/30 transition-colors duration-150">
                <td className="border border-gray-200 px-3 py-1">{type.label}</td>
                {Array.from({ length: getDaysInMonth(selectedMonth, selectedYear) }, (_, day) => {
                  const date = new Date(selectedYear, selectedMonth, day + 1);
                  return (
                    <td key={day} className="border border-gray-200 p-0">
                      <input
                        type="text"
                        value={timeEntries[`${type.id}_${day + 1}`] || ''}
                        onChange={(e) => handleTimeEntry(type.id, day + 1, e.target.value)}
                        className="w-full h-6 text-center focus:outline-none transition-all duration-200 text-sm focus:bg-blue-50/50"
                        maxLength="1"
                      />
                    </td>
                  );
                })}
                <td className="border border-gray-200 px-2 py-1 text-center">{calculateTotalHours(type.id)}</td>
                <td className="border border-gray-200 px-2 py-1 text-center">{calculateTotalHours(type.id)}</td>
                <td colSpan="4" className="border border-gray-200"></td>
              </tr>
            ))}

            {/* Total Non-Chargeable Hours Row */}
            <tr className="bg-gray-50/60 font-medium">
              <td className="border border-gray-200 px-2 py-1 font-medium">Total Non-Chargeable Hours</td>
              {Array.from({ length: getDaysInMonth(selectedMonth, selectedYear) }, (_, day) => (
                <td key={day} className="border border-gray-200 px-2 py-1 text-center">
                  {nonChargeableTypes.reduce((sum, type) => {
                    const value = timeEntries[`${type.id}_${day + 1}`];
                    return sum + (parseInt(value) || 0);
                  }, 0)}
                </td>
              ))}
              <td className="border border-gray-200 px-2 py-1 text-center font-medium">
                {nonChargeableTypes.reduce((sum, type) => sum + calculateTotalHours(type.id), 0)}
              </td>
              <td className="border border-gray-200 px-2 py-1 text-center font-medium">
                {nonChargeableTypes.reduce((sum, type) => sum + calculateTotalHours(type.id), 0)}
              </td>
              <td colSpan="4" className="border border-gray-200"></td>
            </tr>

            {/* Total Hours Row */}
            <tr className="bg-gray-100/80 font-semibold">
              <td className="border border-gray-200 px-2 py-1 font-medium">Total Hours</td>
              {Array.from({ length: getDaysInMonth(selectedMonth, selectedYear) }, (_, day) => {
                const chargeableTotal = clientEntries.reduce((sum, _, index) => {
                  const value = timeEntries[`${index}_${day + 1}`];
                  return sum + (parseInt(value) || 0);
                }, 0);
                const nonChargeableTotal = nonChargeableTypes.reduce((sum, type) => {
                  const value = timeEntries[`${type.id}_${day + 1}`];
                  return sum + (parseInt(value) || 0);
                }, 0);
                return (
                  <td key={day} className="border border-gray-200 px-2 py-1 text-center font-medium">
                    {chargeableTotal + nonChargeableTotal}
                  </td>
                );
              })}
              <td className="border border-gray-200 px-2 py-1 text-center font-medium">
                {clientEntries.reduce((sum, _, index) => sum + calculateTotalHours(index), 0) +
                 nonChargeableTypes.reduce((sum, type) => sum + calculateTotalHours(type.id), 0)}
              </td>
              <td className="border border-gray-200 px-2 py-1 text-center font-medium">
                {clientEntries.reduce((sum, _, index) => sum + calculateTotalHours(index), 0) +
                 nonChargeableTypes.reduce((sum, type) => sum + calculateTotalHours(type.id), 0)}
              </td>
              <td colSpan="4" className="border border-gray-200"></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="mt-6 flex justify-between items-center flex-wrap gap-4">
        <div className="text-xs text-gray-500">* 8 Hours daily excluding Fridays, Saturdays and Public Holidays</div>
        <button 
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium transition-all duration-200 text-sm whitespace-nowrap shadow-sm hover:shadow-md active:shadow-sm"
          onClick={handleSubmit}
        >
          Submit Timesheet
        </button>
      </div>
    </div>
  );
};

export default MonthlyTimesheet;