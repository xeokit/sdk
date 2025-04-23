The xeokit SDK supports viewing various AEC file formats through multiple import pipelines. 

The best pipeline to use depends on the source format and file size.

The table below outlines the recommended pipeline based on format and data size. Smaller files can be loaded directly
into the xeokit Viewer while medium/large files should be preconverted to a more 
compact format, such as to XGF, for optimal
performance. The links on the right take you to the tutorials for the selected pipelines.

<br>

<table class="table table-striped table-bordered table-hover">
  <thead class="thead-dark">
    <tr>
      <th>Model Format</th>
      <th>File Size</th>
      <th>Load Directly vs. Preconvert</th>
      <th>Recommended Articles</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td rowspan="4"><b style="font-size: 20px;">IFC</b></td>
      <td rowspan="2" style="background-color:#90ee9073">0MB - 10MB</td>
      <td>Load Directly</td>
      <td>
        <a href="@@base/userguide/example_IFCLoader_IfcOpenHouse4/">Viewing IFC using IFCLoader</a>
      </td>
    </tr>
    <tr>
      <td>Preconvert</td>
      <td>
        <a href="@@base/userguide/ifc2xgf/">Viewing IFC using  xeoconvert and XGFLoader</a>
      </td>
    </tr>
    <tr>
      <td rowspan="1" style="background-color:lightyellow">10MB - 100MB</td>
      <td>Preconvert</td>
      <td>
        <a href="@@base/userguide/ifc2gltf/">Viewing IFC using  xeoconvert and GLTFLoader</a><br>
        <a href="">Viewing IFC using ifc2gltf2xgf</a>
      </td>
    </tr>
    <tr>
      <td rowspan="1" style="background-color:#ffa50047">100MB - 2GB</td>
      <td>Preconvert</td>
      <td>
        <a href="@@base/userguide/ifc2gltf2xgf/">Viewing IFC using ifc2gltf2xgf</a>
      </td>
    </tr>
    <tr>
      <td rowspan="2"><b style="font-size: 20px;">glTF</b></td>
      <td rowspan="1" style="background-color:#90ee9073">Small</td>
      <td>Load Directly</td>
      <td>
        <a href="@@base/userguide/example_GLTFLoader_MAP/">Viewing glTF using GLTFLoader</a>
      </td>
    </tr>
    <tr>
      <td rowspan="1" style="background-color:#ffa50047">Medium / Large</td>
      <td>Preconvert</td>
      <td>
        <a href="@@base/userguide/gltf2xgf/">Viewing glTF using xeoconvert and XGFLoader</a>
      </td>
    </tr>
    <tr>
      <td rowspan="2"><b style="font-size: 20px;">.BIM</b></td>
      <td style="background-color:#90ee9073">Small</td>
      <td>Load Directly</td>
      <td><a href="@@base/userguide/example_loadDotBIM_BlenderHouse/">Viewing .BIM using DotBIMLoader</a>
      </td>
    </tr>
    <tr>
      <td style="background-color:#ffa50047">Medium / Large</td>
      <td>Preconvert</td>
      <td>
        <a href="@@base/userguide/dotbim2xgf/">Viewing .BIM using xeoconvert and XGFLoader</a>
      </td>
    </tr>
    <tr>
      <td><b style="font-size: 20px;">CityJSON</b></td>
      <td style="background-color:#90ee9073">All Sizes</td>
      <td>Load Directly</td>
      <td>
        <a href="@@base/userguide/example_CityJSONLoader_Railway/">Viewing CityJSON using CityJSONLoader</a>
      </td>
    </tr>
    <tr>
      <td><b style="font-size: 20px;">LAS/LAZ</b></td>
      <td style="background-color:#90ee9073">All Sizes</td>
      <td>Load Directly</td>
      <td>
        <a href="@@base/userguide/example_LASLoader_Pumpkin/">Viewing LAS/LAZ using LASLoader</a>
      </td>
    </tr>
    <tr>
      <td><b style="font-size: 20px;">XKT</b></td>
      <td style="background-color:#90ee9073">All Sizes</td>
      <td>Load Directly</td>
      <td><a href="@@base/userguide/example_XKTLoader_MAP/">Viewing XKT using XKTLoader</a></td>
    </tr>
    <tr>
      <td><b style="font-size: 20px;">XGF</b></td>
      <td style="background-color:#90ee9073">All Sizes</td>
      <td>Load Directly</td>
      <td><a href="@@base/userguide/example_XGFLoader_MAP/">Viewing XGF using XGFLoader</a></td>
    </tr>
  </tbody>
</table>

