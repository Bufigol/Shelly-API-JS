import '../assets/css/DataTable.css'; 

const DataTable = ({ data }) => {
    return (
      <div className="data-table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Longitud</th>
              <th>Latitud</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => {
              const timestamp = item[2];
              const date = new Date(timestamp * 1000);
              const dateString = date.toLocaleDateString();
              const timeString = date.toLocaleTimeString();
              return (
                <tr key={index}>
                  <td>{dateString}</td>
                  <td>{timeString}</td>
                  <td>{item[1]}</td>
                  <td>{item[0]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };
  
  export default DataTable;
  