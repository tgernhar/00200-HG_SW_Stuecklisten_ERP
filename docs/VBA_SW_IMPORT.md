## Sub Main_GET_ALL_FROM_SW(Asssembly_Filepath As String)
'Array to collect all Solidworks Informations
Dim Results As Variant
'Collection for the Dimensions of the Array
Dim sizes As Collection
'Counting variable to go to all Properties from results
Dim i As Long
'Counting variable to go to all Positions from the result array
Dim j As Long
'Value for the needed Colums in Excel Sheet to set the Range for import
Dim I_Col As Long
'Value for the needed Rows in Excel Sheet to set the Range for import
Dim J_Row As Long
'Variable for Child (Part or ASM) to know the change prom Part 1 to part 2 usw.
Dim Child As Long
'Variable to check if there is a new child (beginning of the next part or subassemby in the Resultsarray)
Dim Begin_Properties As Long
'Variable to check if there is the end of the properties of the actual child (of the actual part or subassemby in the Resultsarray)
Dim End_Properties As Long
'Array for the Import Datas after analyseis of the datas for the excel sheet import
Dim SW_DATAS(1 To 40000, 1 To 50) As Variant

'Call the Sub to get all the Informations from the Assembly
Results = Main_Get_All_Parts_and_Properties_From_Assembly(Asssembly_Filepath)

'Check Sizes of the array by the bounds function
Set sizes = xls_Basic.Bounds(Results)
'Varaibel for 1. Dimension of the Result array
I_Col = sizes(1)(1)
'Varaibel for 2. Dimension of the Result array
J_Row = sizes(2)(1)
' Statrting Value for Childs is 0 because there is in befinning only the first part
Child = 0
'Set the start value for Countervariable of the Part / Subassembl Properties
i = 0
'Set the start value for Countervariable of the Entrys in the Array
j = 0

'Select the target Sheet
Worksheets("SW_Import").Select
' Select the target Range to clear the sheet
Range("A:AZ").Clear
'Begin Protpertis and End Propterties start  Value = 0
Begin_Properties = 0
'Begin Protpertis and End Propterties start  Value = 0
End_Properties = 0
'Set the Boom Data Startrow from the submodul and add 1 to get the row below the Headlines
Boom_Data_Startrow = xls_Projektlist.XLS_Boom_Startrow + 1

''Select Projektübersicht sheet
'Worksheets("SW_Import").Select

'Go to every Row of the result array and check what is to do with the result
For j = 0 To J_Row
    ' If the Result = the Chld do nothing
    If Results(0, j) = Child Then
        
     'Analyse the data and set the data to the right position
    Else
        'Set Position to Cell
        If Results(0, j - 1) = "" Then
            SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum) = "-"
        Else
             SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum) = Results(0, j - 1)
        End If
        
        'Set Partname to Cell
        If Results(1, j - 1) = "" Then
            SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum + 2) = "-"
        Else
            SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum + 2) = Results(1, j - 1)
        End If
        
         'Set Configurationname to Cell
        If Results(1, j - 1) = "" Then
            SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum + 3) = "-"
        Else
            SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum + 3) = Results(2, j - 1)
        End If
        
        
        'Set X_Dimension
        If CStr(Results(7, j - 1)) = "" Then
            SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum + 13) = "-"
        Else
             SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum + 13) = CStr(Results(7, j - 1))
        End If
        'Set Y_Dimension
        If CStr(Results(8, j - 1)) = "" Then
            SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum + 14) = "-"
        Else
            SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum + 14) = CStr(Results(8, j - 1))
        End If
        'Set Z_Dimension
        If CStr(Results(9, j - 1)) = "" Then
            SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum + 15) = "-"
        Else
            SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum + 15) = CStr(Results(9, j - 1))
        End If
        'Set Weigth
        If CStr(Results(10, j - 1)) = "" Then
            SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum + 16) = "-"
        Else
            SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum + 16) = CStr(Results(10, j - 1))
        End If
        'Set Filepath Part_ASM
        If CStr(Results(11, j - 1)) = "" Then
            SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum + 17) = "-"
            SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum + 18) = "-"
        Else
            SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum + 17) = Left(Results(11, j - 1), InStrRev(Results(11, j - 1), "\"))
            SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum + 18) = Results(11, j - 1)
        End If
        'Set Filepath Part_ASM
        If CStr(Results(12, j - 1)) = "" Then
            SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum + 19) = "-"
        Else
            SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum + 20) = Results(12, j - 1)
        End If
        'Set Excelude from Boomvalue
            SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum + 21) = Results(13, j - 1)
        'Write Userinfo there are exluded Parts in Boom
        If Results(13, j - 1) = "1" Then
          '  SW_DATAS(Boom_Data_Startrow - 2, xls_Projektlist.XLS_Boom_Startcolum + 2) = "TEILE AUS STL AUSGESCHLOSSEN!!"
           
        End If
        
        'Set Next Beginn to the End Position of this child (part/ ASM)
        Begin_Properties = End_Properties
        'Set new End to the End of the next Child
        End_Properties = j

        
        For i = Begin_Properties To End_Properties - 1
        
             Select Case Results(4, i)
            
                    Case "H+G Artikelnummer"
                        If Results(5, i) = "" Then
                           SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum + 1) = "-"
                       Else
                           SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum + 1) = Results(5, i)
                        End If
                    
                    Case "Teilenummer"
                        If Results(5, i) = "" Then
                           SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum + 4) = "-"
                       Else
                           SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum + 4) = Results(5, i)
                        End If
                    Case "Material"
                        If Results(5, i) = "" Then
                           SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum + 8) = "-"
                       Else
                            SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum + 8) = Results(5, i)
                        End If
                    
                   '*********************************************
                   'Case Colum 5 is reserved for the quantity
                   '*********************************************
                   '     Cells(xls_Projektlist.XLS_Boom_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum + 5).Value = Results(5, i)
                    Case "HUGWAWI - Abteilung"
                       If Results(5, i) = "" Then
                           SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum + 6) = "-"
                       Else
                           SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum + 6) = Results(5, i)
                        End If
                        
                    Case "Werkstoffgruppe"
                        If Results(5, i) = "" Then
                           SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum + 7) = "-"
                       Else
                        
                           SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum + 7) = Results(5, i)
                       End If
                       
                    Case "Oberfläche_ZSB", "Oberfläche"
                        If Results(5, i) = "" Then
                           SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum + 9) = "-"
                       Else
                           SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum + 9) = Results(5, i)
                       End If
                       
                    Case "Oberflächenschutz"
                        If Results(5, i) = "" Then
                            SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum + 10) = "-"
                        Else
                            SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum + 10) = Results(5, i)
                        End If
                        
                    Case "Farbe"
                        If Results(5, i) = "" Then
                           SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum + 11) = "-"
                       Else
                           SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum + 11) = Results(5, i)
                       End If
                       
                    Case "Lieferzeit", "Lieferzeit - geschätzt"
                        If Results(5, i) = "" Then
                           SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum + 12) = "-"
                        Else
                           SW_DATAS(Boom_Data_Startrow + Child, xls_Projektlist.XLS_Boom_Startcolum + 12) = Results(5, i)
                        End If
                        
                    Case Else
            
                    End Select
            
        Next
        
        Child = Child + 1
        
    End If
Next


    'Select Projektübersicht sheet
    Worksheets("SW_Import").Select

 'Write Array to Excelsheet
 Range("A1:AX40000").value = SW_DATAS
'MsgBox (SW_DATAS(1, 1))


End Sub






Function Main_Get_All_Parts_and_Properties_From_Assembly(Assembly_Filepath As String) As Variant

'Errorvalue for Abord
Dim Error                           As Boolean
'Declare Assemblydoc for Assembly
Dim swAssy                          As SldWorks.AssemblyDoc
'Declare Solidworks Configuration
Dim swConfig                        As SldWorks.Configuration
'Declare Solidworks Configurationmanager
Dim swConfigMgr                     As SldWorks.ConfigurationManager
'Declare Solidworks Rootcomponent
Dim swRootComp                      As SldWorks.Component2
    
' Set basic Values
Error = SW_Basic.Set_Basic_Settings
' Open SW Document
Error = SW_Basic.Open_SW_Document(Assembly_Filepath)
'Set Solidworks Assemblydoc to opened ZSB
Set swAssy = SW_Basic.swModel
'Fix all Components, don´t work with lightweight parts in assembly
'swAssy.FixComponent
' Set Configuration Manager on Assembly document
Set swConfigMgr = SW_Basic.swModel.ConfigurationManager
' Set Solidworks Configuration on Configuration Manager
Set swConfig = swConfigMgr.ActiveConfiguration
' Set Rootcomponent to active Config
Set swRootComp = swConfig.GetRootComponent3(True)
'Now Start getting all Configuration and Part Datas
SetCompVisib_2 swRootComp, 0
'Set Result Array to Functionresult
Main_Get_All_Parts_and_Properties_From_Assembly = Part_Properties
    
End Function


'************************************************************************************************************************************************************************************
'********   Sub for go to all Parts and Subassemblys in Assembly to get all Informations
'************************************************************************************************************************************************************************************

Sub SetCompVisib_2(swComp As SldWorks.Component2, k As Integer)
'Declare Partdoc as Modeldoc for Parts in Assembly
Dim Partdoc As SldWorks.ModelDoc2
'Declare Config for Config at Partdoc in Assembly
Dim swConfig As SldWorks.Configuration
'Declare Solidworks Custom Property Manager
Dim swConfigMgr As SldWorks.ConfigurationManager
'Declare cusPropMgr  for Partdoc in Assembly
Dim cusPropMgr As SldWorks.CustomPropertyManager
'Declare Weight as double
Dim Weight As Variant
'Declare Long Return Value as Resultvalue
Dim lRetVal As Long, nNbrProps As Long
'Counting variable
Dim i As Long, j As Long
' Variables for Results of Part Properties
' vPropNames = Custom_Propertienames, vPropTypes = Custom_PropertieTypes, vPropValues = Custom_PropertieValues,
Dim vPropNames As Variant, vPropTypes As Variant, vPropValues As Variant ', ValOut As String
'resolved = Array of evaluation statuses of PropNames as defined in swCustomInfoGetResult_e
Dim resolved As Variant
' link Prop Array of integers indicating whether PropNames are linked to their parent parts: 1 = link 0 = no link
Dim linkProp As Variant
' custPropType = type of PropNames as defined in swCustomInfoType_e
Dim custPropType As Long
'Declare Variable for Child (Parts and sub Assemblys in Assembly)
Dim vChildArray As Variant
'Declare Childcomponent for Parts and sub Assemblys
Dim swChildComp As SldWorks.Component2
'Count of Childs of Assembly
'Dim Child_count As Integer
'Boxmasses of active Part as double 1=x, 2=Y, 3=Z
Dim Boxmasses As Variant
'Resultbool = Boolean Indicatior for Solidworks Function to change the referenced configuration to the active configuration
Dim Resultbool As Boolean


'************************If actuale Component IsEnvelope = True then only write the Filename because eneveloped Parts has no Modeldoc ****************************
If swComp.IsEnvelope = 1 Then
    'To get already the correct Array Dimension first add 1 Count to the Results variable
    Result_Rows = Result_Rows + 1
    'Now redim the Array to get this one Value to the Array
    ReDim Preserve Part_Properties(0 To 13, 0 To Result_Rows)
    'Write the Position Number to the Arrayposition
    Part_Properties(0, l) = k
    'Write the Name of Child (Part or Subassembly) in Assembly
    Part_Properties(1, l) = swComp.Name2
    'Name of Child Property
    Part_Properties(4, l) = "Teilenummer"
    'Value of Child Property
    Part_Properties(5, l) = "Nur Hülle"
    'Part show = 1 or show not =0 in Boom Table
    Part_Properties(13, l) = "0"
    'Add 1 to the Counter to get the right Position in the Array for the next entry
    l = l + 1
    
'************************If actuale Component IsSuppressed = True then only write the Filename because uppressed Parts has no Modeldoc ****************************
ElseIf swComp.GetSuppression2 = 0 Then
    'To get already the correct Array Dimension first add 1 Count to the Results variable
    Result_Rows = Result_Rows + 1
    'Now redim the Array to get this one Value to the Array
    ReDim Preserve Part_Properties(0 To 13, 0 To Result_Rows)
    'Write the Position Number to the Arrayposition
    Part_Properties(0, l) = k
    'Write the Name of Child (Part or Subassembly) in Assembly
    Part_Properties(1, l) = swComp.Name2
    'Name of Child Property
    Part_Properties(4, l) = "Teilenummer"
    'Value of Child Property
    Part_Properties(5, l) = "Unterdrückt"
     'Part show = 1 or show not =0 in Boom Table
    Part_Properties(13, l) = "0"
    'Add 1 to the Counter to get the right Position in the Array for the next entry
    l = l + 1
    
'************************If the actual Component IsEnvelope =False and Suppressed = False then set teh Modeldoc to Partdoc and get all Informations****************************
Else
    
    
    'Set the Partdoc = The Modeldoc of the actual Component to get access to Modeldoc Functionality
    Set Partdoc = swComp.GetModelDoc2
    
    'This Function checks if this Component has some configurations to get the referenced configuration by name and set this configuration to the Partdoc Active Configuration
    Resultbool = Partdoc.ShowConfiguration2(swComp.ReferencedConfiguration)
    
    'Boxmasses = SW_Basic.Main_Get_Boxmass_From_Part(Partdoc)  ******** This is slow, so actual we set all Dimensions to 0 ******
    ReDim Boxmasses(1 To 3) As String
    Boxmasses(1) = "0"
    Boxmasses(2) = "0"
    Boxmasses(3) = "0"
    
    ''Get weigth and Volume Datas From Active Child (Part)      ******** This is slow, so actual we set all Dimensions to 0 ******
    'Weight = Get_Model_Weight_and_Volume(Partdoc)
    ReDim Weight(1 To 5) As String
    Weight(5) = "0"
        
    ' Set Solidworksconfiguration = the Active Configuration of the actual part
    Set swConfig = Partdoc.GetActiveConfiguration
    'Set SWConfig Manager on Partdoc (the active component)
    Set swConfigMgr = Partdoc.ConfigurationManager
    'Set Custom Property Manager on Part
    Set cusPropMgr = swConfig.CustomPropertyManager
    '**********************************************
    '********************************************** IS IN FUCTION ??? UNKNOWN HAS TO BE TESTED ***********************************
    'Create new Entry to generate General HG Customproperties to Part
    Dim curDate As Date
    'get the actual DatetimeValue
    curDate = Now
    'Set the Datetimevariable
    Dim dateFormat As String
    'Set the DateFormat
    dateFormat = Format(curDate, "YYYY-MM-dd")
    
    'SetGeneralProperty Partdoc, "ApprovedDate", dateFormat, swCustomInfoType_e.swCustomInfoDate
    'SetProperty Partdoc.Extension.CustomPropertyManager(""), "ApprovedDate", dateFormat, swCustomInfoType_e.swCustomInfoDate
        
    SetProperty cusPropMgr, "ApprovedDate", dateFormat, swCustomInfoType_e.swCustomInfoDate
    '********************************************** IS IN FUCTION ??? UNKNOWN HAS TO BE TESTED ***********************************
    '**********************************************
    
    'Get the count of all Properties, needed for loop to all of them
    nNbrProps = cusPropMgr.count
    ' For first Run check if k=0 if True set l=0 and Result Row =0
    If k = 0 Then
        Result_Rows = 0
        l = 0
    End If
    'To get already the correct Array Dimension first add needed Count to the Results variable
    Result_Rows = Result_Rows + nNbrProps
    'Set the length of the Array to needed lentgh without loosing Data useing Preserve
    ReDim Preserve Part_Properties(0 To 13, 0 To Result_Rows)
    
    'Get all Properties from this configuration
    lRetVal = cusPropMgr.GetAll3(vPropNames, vPropTypes, vPropValues, resolved, linkProp)
    
    'Get Title From Filename to get off the instances numbers behind the Names2
    Dim sFullPath As String
    Dim sFullFilename As String
    Dim sFileName As String
    
    'Modify the Filepath to get the Filename only
    sFullPath = swComp.GetPathName
    sFullFilename = Right(sFullPath, Len(sFullPath) - InStrRev(sFullPath, "\"))
    sFileName = Left(sFullFilename, (InStrRev(sFullFilename, ".") - 1))
    
    
    ' For each custom property, print its name, type, and evaluated value
    For j = 0 To nNbrProps - 1
        'Counter for Childnr (Part or Subassembly) in Assembly
        Part_Properties(0, l) = k
        'Name of Child (Part or Subassembly) in Assembly
        Part_Properties(1, l) = sFileName
        'Value for visibility of Child (Part or Subassembly) in Assembly 1= Visoble 0=Hidden
        Part_Properties(12, l) = swComp.Visible
        'Value of Child Property id
        Part_Properties(3, l) = swComp.IGetChildrenCount
        'Name of Child Property
        Part_Properties(4, l) = vPropNames(j)
        'Value of Child Property
        Part_Properties(5, l) = vPropValues(j)
        'Type of Child Property
        Part_Properties(6, l) = custPropType
        'Dimension of Part X
        Part_Properties(7, l) = Round(Boxmasses(1), 0)
        'Dimension of Part Y
        Part_Properties(8, l) = Round(Boxmasses(2), 0)
        'Dimension of Part Z
        Part_Properties(9, l) = Round(Boxmasses(3), 0)
        'Weigth in KG of Part
        Part_Properties(10, l) = Round(Weight(5), 1)
        'ASM or PRT Path
        Part_Properties(11, l) = swComp.GetPathName
        'Debug.Print swComp.GetPathName
        'Configuration Name
        Part_Properties(2, l) = swConfigMgr.ActiveConfiguration.Name
        'Part_Properties(2, l) = swComp.ReferencedConfiguration
    
        'Part show = 1 or show not =0 in Boom Table
        If swComp.ExcludeFromBOM = False Then
            'Included in Boom = True = 1
            Part_Properties(13, l) = "1"
        Else
            Part_Properties(13, l) = "0"
        End If
           
'         If j = nNbrProps - 1 Then
'                Debug.Print "Pos " & k & "Name: " & swConfigMgr.ActiveConfiguration.Name
'         End If
        '
        l = l + 1
    Next j
End If
'
'swComp.Visible = swComponentVisible
vChildArray = swComp.GetChildren
For i = 0 To UBound(vChildArray)
   ' l = l + nNbrProps
    k = k + 1
    Set swChildComp = vChildArray(i)
    'Go to Next Part
    SetCompVisib_2 swChildComp, k

    
Next i
End Sub


Sub Get_Custom_Properties()

Dim swAssy As SldWorks.AssemblyDoc
Dim swConfig  As SldWorks.Configuration
Dim swConfigMgr As SldWorks.ConfigurationManager
Dim swRootComp As SldWorks.Component2
Dim cusPropMgr As SldWorks.CustomPropertyManager
Dim Config  As SldWorks.Configuration
Dim bRet As Boolean
Dim lRetVal As Long

'Errorvalue for Abord
Dim Error As Boolean

' Set basic Values
Error = SW_Basic.Set_Basic_Settings
' Open SW Document
Error = SW_Basic.Open_SW_Document("C:\Thomas\Solidworks\905889-0001000A ESD Makrolonverkleidung\905889-0001000A ESD Makrolonabdeckungen an Maschinenschnittstelle.SLDASM")
'Get Datas from Boom Table

Set swAssy = SW_Basic.swModel
Set swConfigMgr = SW_Basic.swModel.ConfigurationManager
Set swConfig = swConfigMgr.ActiveConfiguration
Set swRootComp = swConfig.GetRootComponent3(True)

'Set swModel = swApp.ActiveDoc
Set Config = SW_Basic.swModel.GetActiveConfiguration
'Set CustomPropertyManager
Set cusPropMgr = Config.CustomPropertyManager


' bRet = cusPropMgr.IsCustomPropertyEditable("Stückliste", config.Name)
 bRet = cusPropMgr.IsCustomPropertyEditable("Stückliste", Config.Name)
 If bRet = 0 Then
     Debug.Print "    ADATE is editable."
     lRetVal = cusPropMgr.Set2("H+G Artikelnummer", "094070-001122244A")
 Else
     Debug.Print "    ADATE is not editable."
 End If
 
 SetCompVisib swRootComp
End Sub


Sub SetProperty(custPrpMgr As SldWorks.CustomPropertyManager, prpName As String, prpVal As String, Optional prpType As swCustomInfoType_e = swCustomInfoType_e.swCustomInfoText)
    
    Dim res As Long
    res = custPrpMgr.Add3(prpName, prpType, prpVal, swCustomPropertyAddOption_e.swCustomPropertyReplaceValue)
    
    If res <> swCustomInfoAddResult_e.swCustomInfoAddResult_AddedOrChanged Then
        err.Raise vbError, "", "Failed to set custom property. Error code: " & res
    End If
End Sub
