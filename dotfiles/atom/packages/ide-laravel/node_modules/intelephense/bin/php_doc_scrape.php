<?php
        
    if($argc !== 2){
        die('Usage: php php_doc_scrape.php <PHP_DOC_DIR>');
    }
    
    if(!($dir = new DirectoryIterator($argv[1]))){
        die('Failed to open ' . $argv[1]);
    }
    
    
    $constantFiles = [
        'constants.dbx.html','dir.constants.html', 'ftp.constants.html', 'gmp.constants.html','url.constants.html','xml.constants.html','xsl.constants.html','curl.constants.html',
        'exif.constants.html','hash.constants.html','intl.constants.html', 'json.constants.html','ldap.constants.html','misc.constants.html','mysql.constants.html','oci8.constants.html',
        'pcre.constants.html','soap.constants.html','tidy.constants.html','zlib.constants.html','array.constants.html',
        'fbsql.constants.html','iconv.constants.html','image.constants.html','mssql.constants.html','mysql.constants.html','pnctl.constants.html','pgsql.constants.html','filter.constants.html',
         'libxml.constants.html','mysqli.constants.html','sqlite.constants.html','stream.constants.html','string.constants.html', 'network.constants.html', 'session.constants.html', 'sockets.constants.html',
        'sqlite3.constants.html','calendar.constants.html','datetime.constants.html','fileinfo.constants.html','mbstring.constants.html','reserved.constants.html','filesystem.constants.html',
        'posix.constants.mknod.html','posix.constants.access.html','posix.constants.setrlimit.html','math.constants.html'
        
        
    ];

    const S_Class = 1 << 0;
    const S_Interface = 1 << 1;
    const S_Trait = 1 << 2;
    const S_Constant = 1 << 3;
    const S_Property = 1 << 4;
    const S_Method = 1 << 5;
    const S_Function = 1 << 6;
    const S_Parameter = 1 << 7;
    const S_Variable = 1 << 8;
    const S_Namespace = 1 << 9;
    const S_ClassConstant = 1 << 10;

    const M_Public = 1 << 0;
    const M_Protected = 1 << 1;
    const M_Private = 1 << 2;
    const M_Final = 1 << 3;
    const M_Abstract = 1 << 4;
    const M_Static = 1 << 5;
    const M_ReadOnly = 1 << 6;
    const M_WriteOnly = 1 << 7;
    const M_Magic = 1 << 8;
    const M_Anonymous = 1 << 9;
    const M_Reference = 1 << 10;
    const M_Variadic = 1 << 11;
    const M_Use = 1 << 12;

    
    $start = microtime(true);
    
    libxml_use_internal_errors();
    
    $symbols = array();
    $start = microtime(true);
    foreach ($dir as $fileinfo) {
        if ($fileinfo->isDot() || $fileinfo->isDir()) {
            continue;
        }
        
        $dom = new DOMDocument();
        if(!@$dom->loadHTMLFile($fileinfo->getPathname())){
            echo "Failed to load DOM\n";
        }

        if(in_array($fileinfo->getFilename(), $constantFiles)){
               foreach(getConstants($dom) as $s){
                   $symbols[$s['name']] = $s;
               }
        } else {

        $classSymbol = getClassPropertiesConstants($dom);
        if($classSymbol){
            $symbols[$classSymbol['name']] = $classSymbol;
        }
        }
    }

foreach ($dir as $fileinfo) {
        if ($fileinfo->isDot() || $fileinfo->isDir()) {
            continue;
        }
        
        $dom = new DOMDocument();
        if(!@$dom->loadHTMLFile($fileinfo->getPathname())){
            echo "Failed to load DOM\n";
        }

        if(in_array($fileinfo->getFilename(), $constantFiles)){
               
        } else {
        
        getFunctionInfo($dom, $symbols);
        }
    }   
    
    $out = 'builtInSymbols.json';
    
    $otherSymbols = [
        '$GLOBALS'=> [
		"kind"=>S_Variable,
        "name"=> '$GLOBALS',
        "description"=> 'An associative array containing references to all variables which are currently defined in the global scope of the script. The variable "name"s are the keys of the array.',
	],
	'$_SERVER'=> [
		"kind"=>S_Variable,
        
        "name"=> '$_SERVER',
        "description"=> '$_SERVER is an array containing information such as headers, paths, and script locations. The entries in this array are created by the web server. There is no guarantee that every web server will provide any of these; servers may omit some, or provide others not listed here. That said, a large number of these variables are accounted for in the CGI/1.1 specification, so you should be able to expect those.',
	],
	'$_GET'=> [
		"kind"=>S_Variable,
        
        "name"=> '$_GET',
        "description"=> 'An associative array of variables passed to the current script via the URL parameters.',
	],
	'$_POST'=> [
		"kind"=>S_Variable,
        
        "name"=> '$_POST',
        "description"=> 'An associative array of variables passed to the current script via the HTTP POST method.',
	],
	'$_FILES'=> [
		"kind"=>S_Variable,
        
        "name"=> '$_FILES',
        "description"=> 'An associative array of items uploaded to the current script via the HTTP POST method.',
	],
	'$_REQUEST'=> [
		"kind"=>S_Variable,
        
        "name"=> '$_REQUEST',
        "description"=> 'An associative array that by default contains the contents of $_GET, $_POST and $_COOKIE.',
	],
	'$_SESSION'=> [
		"kind"=>S_Variable,
        
        "name"=> '$_SESSION',
        "description"=> 'An associative array containing session variables available to the current script. See the Session functions documentation for more information on how this is used.',
	],
	'$_ENV'=> [
		"kind"=>S_Variable,
        
        "name"=> '$_ENV',
        "description"=> 'An associative array of variables passed to the current script via the environment method. \r\n\r\nThese variables are imported into PHP\'s global "name"space from the environment under which the PHP parser is running. Many are provided by the shell under which PHP is running and different systems are likely running different kinds of shells, a definitive list is impossible. Please see your shell\'s documentation for a list of defined environment variables. \r\n\r\nOther environment variables include the CGI variables, placed there regardless of whether PHP is running as a server module or CGI processor.',
	],
	'$_COOKIE'=> [
		"kind"=>S_Variable,
        
        "name"=> '$_COOKIE',
        "description"=> 'An associative array of variables passed to the current script via HTTP Cookies.',
	],
	'$php_errormsg'=> [
		"kind"=>S_Variable,
        
        "name"=> '$php_errormsg',
        "description"=> '$php_errormsg is a variable containing the text of the last error message generated by PHP. This variable will only be available within the scope in which the error occurred, and only if the track_errors configuration option is turned on (it defaults to off).',
	],
	'$HTTP_RAW_POST_DATA'=> [
		"kind"=>S_Variable,
        
        "name"=> '$HTTP_RAW_POST_DATA',
        "description"=> '$HTTP_RAW_POST_DATA contains the raw POST data. See always_populate_raw_post_data',
	],
	'$http_response_header'=> [
		"kind"=>S_Variable,
        
        "name"=> '$http_response_header',
        "description"=> 'The $http_response_header array is similar to the get_headers() function. When using the HTTP wrapper, $http_response_header will be populated with the HTTP response headers. $http_response_header will be created in the local scope.',
	],
	'$argc'=> [
		"kind"=>S_Variable,
        
        "name"=> '$argc',
        "description"=> 'Contains the number of arguments passed to the current script when running from the command line.',
	],
	'$argv'=> [
		"kind"=>S_Variable,
        
        "name"=> '$argv',
        "description"=> 'Contains an array of all the arguments passed to the script when running from the command line.',
	],
	'$this'=> [
		"kind"=>S_Variable,
        
        "name"=> '$this',
        "description"=> 'Refers to the current object',
    ],
    '__CLASS__'=> [
		'kind'=>S_Constant,
        
        'name'=>'__CLASS__',
        'description'=> 'The class name. (Added in PHP 4.3.0) As of PHP 5 this constant returns the class name as it was declared (case-sensitive). In PHP 4 its value is always lowercased.',
    ],
	'__DIR__'=> [
		'kind'=>S_Constant,
        
        'name'=>'__DIR__',
        'description'=> 'The directory of the file. If used inside an include, the directory of the included file is returned. This is equivalent to dirname(__FILE__). This directory name does not have a trailing slash unless it is the root directory. (Added in PHP 5.3.0.)',
    ],
	'__FILE__'=> [
		'kind'=>S_Constant,
        
        'name'=>'__FILE__',
        'description'=> 'The full path and filename of the file. If used inside an include, the name of the included file is returned. Since PHP 4.0.2, __FILE__ always contains an absolute path with symlinks resolved whereas in older versions it contained relative path under some circumstances.',
    ],
	'__FUNCTION__'=> [
		'kind'=>S_Constant,
        
        'name'=>'__FUNCTION__',
        'description'=> 'The function name. (Added in PHP 4.3.0) As of PHP 5 this constant returns the function name as it was declared (case-sensitive). In PHP 4 its value is always lowercased.',
    ],
	'__LINE__'=> [
		'kind'=>S_Constant,
        
        'name'=>'__LINE__',
        'description'=> 'The current line number of the file.',
    ],
	'__METHOD__'=> [
		'kind'=>S_Constant,
        
        'name'=>'__METHOD__',
        'description'=> 'The class method name. (Added in PHP 5.0.0) The method name is returned as it was declared (case-sensitive).',
    ],
	'__NAMESPACE__'=> [
		'kind'=>S_Constant,
        
        'name'=>'__NAMESPACE__',
        'description'=> 'The name of the current namespace (case-sensitive). This constant is defined in compile-time (Added in PHP 5.3.0).',
    ],
	'M_PI'=> [
		'kind'=>S_Constant,
        
        'name'=>'M_PI',
        'description'=> 'The constant Pi=> 3.14159265358979323846',
    ],
	'M_E'=> [
		'kind'=>S_Constant,
        
        'name'=>'M_E',
        'description'=> 'The constant e=> 2.7182818284590452354',
    ],
	'M_LOG2E'=> [
		'kind'=>S_Constant,
        
        'name'=>'M_LOG2E',
        'description'=> 'The constant log_2 e=> 1.4426950408889634074',
    ],
	'M_LOG10E'=> [
		'kind'=>S_Constant,
        
        'name'=>'M_LOG10E',
        'description'=> 'The constant log_10 e=> 0.43429448190325182765',
    ],
	'M_LN2'=> [
		'kind'=>S_Constant,
        
       'name'=>'M_LN2',
        'description'=> 'The constant log_e 2=> 0.69314718055994530942',
    ],
	'M_LN10'=> [
		'kind'=>S_Constant,
        
        'name'=>'M_LN10',
        'description'=> 'The constant log_e 10=> 2.30258509299404568402',
    ],
	'M_PI_2'=> [
		'kind'=>S_Constant,
        
        'name'=>'M_PI_2',
        'description'=> 'The constant pi/2=> 1.57079632679489661923',
    ],
	'M_PI_4'=> [
		'kind'=>S_Constant,
        
        'name'=>'M_PI_4',
        'description'=> 'The constant pi/4=> 0.78539816339744830962',
    ],
	'M_1_PI'=> [
		'kind'=>S_Constant,
        
        'name'=>'M_1_PI',
        'description'=> 'The constant 1/pi=> 0.31830988618379067154',
    ],
	'M_2_PI'=> [
		'kind'=>S_Constant,
        
        'name'=>'M_2_PI',
        'description'=> 'The constant 2/pi=> 0.63661977236758134308',
    ],
	'M_SQRTPI'=> [
		'kind'=>S_Constant,
        
        'name'=>'M_SQRTPI',
        'description'=> 'The constant sqrt(pi)=> 1.77245385090551602729',
    ],
	'M_2_SQRTPI'=> [
		'kind'=>S_Constant,
        
        'name'=>'M_2_SQRTPI',
        'description'=> 'The constant 2/sqrt(pi)=> 1.12837916709551257390',
    ],
	'M_SQRT2'=> [
		'kind'=>S_Constant,
        
        'name'=>'M_SQRT2',
        'description'=> 'The constant sqrt(2)=> 1.41421356237309504880',
    ],
	'M_SQRT3'=> [
		'kind'=>S_Constant,
        
        'name'=>'M_SQRT3',
        'description'=> 'The constant sqrt(3)=> 1.73205080756887729352',
    ],
	'M_SQRT1_2'=> [
		'kind'=>S_Constant,
        
        'name'=>'M_SQRT1_2',
        'description'=> 'The constant 1/sqrt(2)=> 0.7071067811865475244',
    ],
	'M_LNPI'=> [
		'kind'=>S_Constant,
        
        'name'=>'M_LNPI',
        'description'=> 'The constant log_e(pi)=> 1.14472988584940017414',
    ],
	'M_EULER'=> [
		'kind'=>S_Constant,
        
        'name'=>'M_EULER',
        'description'=> 'Euler constant=> 0.57721566490153286061',
    ],
	'PHP_ROUND_HALF_UP'=> [
		'kind'=>S_Constant,
        
        'name'=>'PHP_ROUND_HALF_UP',
        'description'=> 'Round halves up = 1',
    ],
	'PHP_ROUND_HALF_DOWN'=> [
		'kind'=>S_Constant,
        
        'name'=>'PHP_ROUND_HALF_DOWN',
        'description'=> 'Round halves down = 2',
    ],
	'PHP_ROUND_HALF_EVEN'=> [
		'kind'=>S_Constant,
        
        'name'=>'PHP_ROUND_HALF_EVEN',
        'description'=> 'Round halves to even numbers = 3',
    ],
	'PHP_ROUND_HALF_ODD'=> [
		'kind'=>S_Constant,
        
        'name'=>'PHP_ROUND_HALF_ODD',
        'description'=> 'Round halvesto odd numbers = 4',
    ],
	'NAN'=> [
		'kind'=>S_Constant,
        
        'name'=>'NAN',
        'description'=> 'NAN (as a float): Not A Number',
    ],
	'INF'=> [
		'kind'=>S_Constant,
        
        'name'=>'INF',
        'description'=> 'INF (as a float): The infinite',
    ],
	'PASSWORD_BCRYPT'=> [
		'kind'=>S_Constant,
        
        'name'=>'PASSWORD_BCRYPT',
        'description'=> 'PASSWORD_BCRYPT is used to create new password hashes using the CRYPT_BLOWFISH algorithm.',
    ],
	'PASSWORD_DEFAULT'=> [
		'kind'=>S_Constant,
        
        'name'=>'PASSWORD_DEFAULT',
        'description'=> 'The default algorithm to use for hashing if no algorithm is provided. This may change in newer PHP releases when newer, stronger hashing algorithms are supported.',
    ],
    
    ];
    
    
    $symbols = array_merge($symbols, $otherSymbols);
    
    
    
    write($symbols, $out);
    
    var_dump(count($symbols), (microtime(true) - $start));
    
    function write($symbols, $file){
 

        file_put_contents($file, json_encode(array_values($symbols)));
        return;

        //$string = "export var builtInSymbols: SymbolMap = ";
        
        $string = writeSymbolMap(array_values($symbols));
        
        //$string .= ";";
        file_put_contents($file, $string);
    }

    function writeSymbolMap($array){

        $symbolStrings = array();
        foreach($array as $k => $s){
    
            $key = '\'' . addslashes($k) . '\'';
            
            $properties = [];
            foreach($s as $propName => $propValue){
                if($propName === 'children'){
                    $propValue = writeSymbolMap($propValue);
                } else if(is_array($propValue)){
                    $propValue = '[' . implode(',', array_map(function($v){
                        return '"' . addslashes($v) . '"';
                    }, $propValue)) . ']';
                }
                else if(is_string($propValue)){
                    //$propValue = '"' . str_replace('"', '\\"', $propValue) . '"';
                    $propValue = '\'' . addslashes($propValue) . '\'';
                }
                
                $properties[] = $propName . ':' . $propValue; 
            }
            
            $symbolStrings[] = " {    \n" . implode(",\n", $properties) . "\n    }";
            
        }

        return "[\n" . implode(",\n", $symbolStrings) . "\n]";

    }
    
    function getConstants($dom){
        
        $symbols = array();
        
        $dlNodes = $dom->getElementsByTagName('dl');
        
        $constants = array();
        $lastDt = null;
        if(!$dlNodes->length){
            return [];   
        }
        
        
        for($n = 0; $n < $dlNodes->length; ++$n){
            $dl = $dlNodes->item($n);
            foreach ($dl->childNodes as $child) {
                if(!($child instanceof DOMElement)){
                    continue;
                }
                
                if($child->tagName === 'dt'){
                    $lastDt = explode(' ', preg_replace('~\s+~',' ', trim($child->textContent)));
                    $lastDt = array_shift($lastDt);
                } else if($child->tagName === 'dd'){
                    $constants[$lastDt] = trim(preg_replace('~\s+~', ' ', $child->textContent));
                }
            }
        
        }
        
        foreach($constants as $key=>$value){
            
            $symbols[] = [
                'kind'=>S_Constant,
                'name'=>$key,
                'description'=>$value
            ];
            
        }
        return $symbols;
    }
    
    function getClassPropertiesConstants($dom){
        
        
        $xpath = new DOMXpath($dom);
        
        $classNodes = $xpath->query('(/html/body/div[2]/div/div[2]/div/div[contains(@class, "classsynopsisinfo")])[1]');
        if(!$classNodes->length){
            return null;
        }
        
        $versionNode = $xpath->query('/html/body//p[contains(@class, "verinfo")]');
        if(!$versionNode->length || stripos($versionNode->item(0)->nodeValue, 'php') === false || stripos($versionNode->item(0)->nodeValue, '<') !== false){
            return null;
        }
        
        $classString = $classNodes->item(0)->textContent;
        
        $flags = 0;
        if(strpos($classString, 'abstract') !== false){
            $flags |= M_Abstract;
        }
        
        if(strpos($classString, 'final') !== false){
            $flags |= M_Final;
        }
        
        
        $hasBase = stripos($classString, 'extends') !== false;
        $classString = trim(preg_replace('~\s+,\s+|\s+(?:extends|implements|abstract|final)\s+|\s+~', ' ',$classString), " \t\n\r\0\x0B{");
        $classExplode = explode(' ', $classString);
        
        $className = array_shift($classExplode);
        $classContext = '';
        if(($separator = strrpos($className, '\\')) !== false){
            $classContext = substr($className, $separator + 1);
            $className = substr($className, 0, $separator);
        }
        
        if(strpos($className, 'PDF') !== false || strpos($className, 'SWF') !== false){
            return null;
        }
        
        $descriptionNodes = $xpath->query('/html/body/div[2]/div/div[1]/p');
        $description = '';
        if($descriptionNodes->length){
            $description = trim(preg_replace('~\s+~', ' ', $descriptionNodes->item(0)->nodeValue));
        }
        
        $headingNodes = $xpath->query('/html/body//h2');
        $type = S_Class; //class
        
        if(stripos($className, 'interface') !==false ){
            $type = S_Interface;
        }
        
        if($headingNodes->length){
            for($n = 0; $n < $headingNodes->length; ++$n){
            $heading = $headingNodes->item($n)->textContent;
            if(stripos($heading, 'interface') !== false){
                $type = S_Interface; //interface
                break;
            }
            }
        }
        

        $associatedSymbols = [];
        if($hasBase){
            $baseClass = array_shift($classExplode);
            if($baseClass){
                $associatedSymbols[] = ['kind'=>S_Class, 'name'=>$baseClass];
            }
        }
        while($implementsInterface = array_shift($classExplode)){
            $associatedSymbols[] = ['kind'=>S_Interface, 'name'=>$implementsInterface];
        }

        
        $classSymbol = array(
          'kind'=>$type,
          'name'=>$className,
          'modifiers'=>$flags,
          'associated'=>$associatedSymbols,
          'description'=>$description,
          'children'=>array()
        );
        
        //$symbols[] = $classSymbol;
        
        //var_dump($classSymbol);
        
        
        //class properties
        $propNodeList = $xpath->query('/html/body//div[contains(@class, "classsynopsis")]/div[contains(@class, "fieldsynopsis")]');
        $propdescriptionNodes = $dom->getElementsByTagName('dl');
        
        if(!$propNodeList->length){
            return $classSymbol;
        }
        
        $propDescriptions = array();
        $lastDt = null;
        if($propdescriptionNodes->length){
            $dl = $propdescriptionNodes->item(0);
            foreach ($dl->childNodes as $child) {
                if(!($child instanceof DOMElement)){
                    continue;
                }
                
                if($child->tagName === 'dt'){
                    $lastDt = trim($child->textContent);
                } else if($child->tagName === 'dd'){
                    $propDescriptions[$lastDt] = trim(preg_replace('~\s+~', ' ', $child->textContent));
                }
            }
        }
        
        //var_dump($propDescriptions);
        
        for($n = 0; $n < $propNodeList->length; ++$n){
            
            $property = preg_replace('~\s+~', ' ',$propNodeList->item($n)->textContent);
            //var_dump(array($className, $property));
            $matches = array();
            if(!preg_match('~\s*(?:(readonly|static)\s+)?(public|protected|const)\s+(?:([^\s]+)\s+)(\$?[^\s;]+)~', $property, $matches)){
                continue;
            }
            
            
            list($all, $readonly, $modifier, $type, $name) = $matches;
            
            $flags = 0;
            if($readonly === 'static'){
                $flags |= M_Static;
            }
            
            if($modifier === 'public' || $modifier === 'const'){
                $flags |= M_Public;
            }
            
            if($modifier === 'protected'){
                $flags |= M_Protected;
            }
            
            if(!$flags){
                $flags = M_Public;
            }
            
            //look for description
            $trimmedName = trim($name, "\$ \t\n\r\0\x0B");
            $description = isset($propDescriptions[$trimmedName]) ? $propDescriptions[$trimmedName] : '';
            
             $symbol = array(
            'kind'=> $modifier === 'const' ? S_Constant : S_Property,
            'name'=>$name,
            'modifiers'=>$flags,
            'type'=>$type,//explode('|', $type),
            'description'=>$description 
            );
            $classSymbol['children'][$symbol['name']] = $symbol;
            //var_dump($symbol);
        }
        if(isset($classSymbol['children'])){
            $classSymbol['children'] = array_values($classSymbol['children']);
        }
        return $classSymbol;
    }
    
    function getFunctionInfo($dom, &$symbols){
        
        $xpath = new DOMXpath($dom);
        $nodes = $xpath->query('/html/body/div[2]/div[2 and contains(@class, "refsect1")]/div[contains(@class, "dc-description")]');
        if(!$nodes->length){
            return;
        }
        
        $versionNode = $xpath->query('/html/body//p[contains(@class, "verinfo")]');
        if(!$versionNode->length || stripos($versionNode->item(0)->nodeValue, 'php') === false || stripos($versionNode->item(0)->nodeValue, '<') !== false){
            return;
        }
        
        $descriptionNodes = $xpath->query('(/html/body/div[2]/div[2]/p[contains(@class, "rdfs-comment")])[last()]');
        $description = '';
        if($descriptionNodes->length){
            $description = trim(preg_replace('~\s+~', ' ', $descriptionNodes->item(0)->nodeValue));
        }
        
        for($n = 0; $n < $nodes->length; ++$n){
        
        $signature = preg_replace('~\s+~', ' ',$nodes->item($n)->textContent);
        
        $pattern = '~\s*(?:(final)\s+)?(?:(static)\s+)?(?:(public|private|protected)\s+)?([^\s:]*)\s+(?:([^\s:]+)::([^\s:]+)|([^\s:]+))\s*\(\s*(.*)\s*\)\s*~s';
        
        $matches = array();
        if(!preg_match($pattern, $signature, $matches)){
            continue;
        }
        
        
        
        foreach($matches as $key => $value){
            $matches[$key] = trim($value);
        }
        
        list($all, $final, $static, $public, $returnType, $class, $classMethod, $function, $parameters) = $matches;
        
        if(strpos($class, 'SWF') !== false || strpos($class, 'PDF') !== false || strpos($function, 'PDF') !== false || strpos($function, 'yaz_') !== false || strpos($function, 'ming_') !== false 
        || strpos($function, 'fdf_') === 0 || strpos($function, 'vpopmail') === 0){
            return;
        }
        
        $flags = 0;
        
        
        if($final){
            $flags |= M_Final;
        }
        
        if($static){
            $flags |= M_Static;
        }
        
        if($public === 'public'){
            $flags |= M_Public;
        }
        
         if($public === 'private'){
            $flags |= M_Private;
        }
        
         if($public === 'protected'){
            $flags |= M_Protected;
        }
        
        
        if($parameters === 'void'){
            $parameters = '';
        }
        
        if(!$returnType){
            $returnType = $classMethod === '__construct' ? $class : 'void';
        }
        
        $symbol = array(
            'kind'=>$class ? S_Method : S_Function,
            'name'=>$class ? $classMethod : $function,
            'modifiers'=>$flags,
            'description'=>$description,
            'type'=>$returnType,//explode('|', $returnType),
            'children'=>array()
        );
        if($symbol['name']){
            
            
        } else {
            continue;
        }
        
        //params
        $propdescriptionNodes = $dom->getElementsByTagName('dl');
        
        $propDescriptions = array();
        $lastDt = null;
        if($propdescriptionNodes->length){
            $dl = $propdescriptionNodes->item(0);
            foreach ($dl->childNodes as $child) {
                if(!($child instanceof DOMElement)){
                    continue;
                }
                
                if($child->tagName === 'dt'){
                    $lastDt = trim($child->textContent);
                } else if($child->tagName === 'dd'){
                    $propDescriptions[$lastDt] = trim(preg_replace('~\s+~', ' ', $child->textContent));
                }
            }
        }
        
        //parse params
        $paramSplit = array_filter(preg_split('~\s*\[\s*,\s*|\s+,(?![\'"])\s*~', $parameters, -1, PREG_SPLIT_NO_EMPTY));
        
        foreach($paramSplit as $p){
            
            $parts = preg_split('~\s+|\s*=\s*~', trim($p, " \t\n\r\0\x0B]["),-1, PREG_SPLIT_NO_EMPTY);
            
            $type = array_shift($parts);
            $name = array_shift($parts);
            $value = array_shift($parts);
            
            $flags = 0;
            if(strpos(trim($name), '&') === 0){
                $flags |= M_Reference;
            }
            
            if(strpos(trim($name), '.') === 0){
                $flags |= M_Variadic;
            }
            
            if(!trim($name, '$.')){
                continue;
            }
            
            $paramSymbol = array(
                'kind'=>S_Parameter,
                'name'=>trim($name, '&'),
                'type'=>$type,//explode('|', $type),
                'modifiers'=>$flags,
                'description'=>isset($propDescriptions[trim($name, '$&')]) ? $propDescriptions[trim($name, '$&')] : '',
                
            );
            if($value !== null){
                $paramSymbol['value'] = $value;
            }
            $symbol['children'][$paramSymbol['name']] = $paramSymbol;
        }

        $symbol['children'] = array_values($symbol['children']);
if($class && isset($symbols[$class])){
                $symbols[$class]['children'][$symbol['name']] = $symbol;
            } else {
                $symbols[$symbol['name']] = $symbol;
            }
        }

        array_walk($symbols, function(&$v, $k){
            if(isset($v['children'])){
                $v['children'] = array_values($v['children']);
            }
        });

        return $symbols;
    }

    function childrenToNumericalArray($array){

        if(isset($array['children'])){
            $nonAssociative = [];
            foreach($array['children'] as $key => $child){
                $nonAssociative[] = childrenToNumericalArray($child);
            }
            $array['children'] = $nonAssociative;

        }

        return $array;

    }